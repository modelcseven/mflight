import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { one, q, many } from '../db.js';
import { requireAuth, clearSession, issueSession } from '../auth.js';
import { profileOut, orderOut } from '../serialize.js';
import { getSetting } from '../settings.js';
import { audit } from '../audit.js';
import { createOrder, checkoutUrl, stripeEnabled } from '../payments.js';
import { ah, bad, EMAIL_RE, str, bool } from '../util.js';

export const router = Router();
router.use(requireAuth);

async function checkPassword(user, password) {
  if (!user.password_hash) return true; // social-only accounts have no password yet
  if (!password || !(await bcrypt.compare(String(password), user.password_hash))) throw bad('Current password is incorrect.');
  return true;
}

const reload = (id) => one('SELECT * FROM users WHERE id=$1', [id]);

router.patch('/', ah(async (req, res) => {
  const b = req.body;
  const firstName = b.firstName !== undefined ? str(b.firstName, 60) : req.user.first_name;
  if (!firstName) throw bad('First name is required.');
  await q(
    `UPDATE users SET first_name=$2, last_name=$3, location=$4, bio=$5, phone=$6, avatar_url=$7 WHERE id=$1`,
    [
      req.user.id,
      firstName,
      b.lastName !== undefined ? str(b.lastName, 60) : req.user.last_name,
      b.location !== undefined ? str(b.location, 120) : req.user.location,
      b.bio !== undefined ? str(b.bio, 600) : req.user.bio,
      b.phone !== undefined ? str(b.phone, 40) : req.user.phone,
      b.avatarUrl !== undefined ? str(b.avatarUrl, 300) || null : req.user.avatar_url,
    ],
  );
  res.json({ user: await profileOut(await reload(req.user.id)) });
}));

router.patch('/email', ah(async (req, res) => {
  const email = str(req.body.email, 200).toLowerCase();
  if (!EMAIL_RE.test(email)) throw bad('Enter a valid email address.');
  await checkPassword(req.user, req.body.password);
  if (await one('SELECT 1 FROM users WHERE email=$1 AND id<>$2', [email, req.user.id])) throw bad('That email is already used by another account.');
  const authS = await getSetting('auth');
  await q('UPDATE users SET email=$2, email_verified=$3 WHERE id=$1', [req.user.id, email, !authS.requireEmailVerification]);
  await audit(req, 'account.email_changed', 'user', req.user.id);
  res.json({ user: await profileOut(await reload(req.user.id)) });
}));

router.patch('/password', ah(async (req, res) => {
  const next = String(req.body.newPassword || '');
  if (next.length < 8) throw bad('New password must be at least 8 characters.');
  await checkPassword(req.user, req.body.currentPassword);
  const user = await one(
    'UPDATE users SET password_hash=$2, token_version=token_version+1 WHERE id=$1 RETURNING *',
    [req.user.id, await bcrypt.hash(next, 10)],
  );
  issueSession(res, user); // signs out other devices, keeps this one
  await audit(req, 'account.password_changed', 'user', req.user.id);
  res.json({ user: await profileOut(user) });
}));

router.post('/signout-everywhere', ah(async (req, res) => {
  const user = await one('UPDATE users SET token_version=token_version+1 WHERE id=$1 RETURNING *', [req.user.id]);
  issueSession(res, user);
  res.json({ ok: true });
}));

router.patch('/preferences', ah(async (req, res) => {
  const keys = ['newsletter', 'eventReminders', 'garageUpdates', 'marketplace', 'emailNotifications'];
  const prefs = { ...req.user.prefs };
  for (const k of keys) if (k in req.body) prefs[k] = bool(req.body[k]);
  await q('UPDATE users SET prefs=$2 WHERE id=$1', [req.user.id, prefs]);
  res.json({ user: await profileOut(await reload(req.user.id)) });
}));

router.patch('/privacy', ah(async (req, res) => {
  const keys = ['publicProfile', 'publicGarage', 'allowMessages'];
  const privacy = { ...req.user.privacy };
  for (const k of keys) if (k in req.body) privacy[k] = bool(req.body[k]);
  await q('UPDATE users SET privacy=$2 WHERE id=$1', [req.user.id, privacy]);
  res.json({ user: await profileOut(await reload(req.user.id)) });
}));

// Two-step verification (TOTP authenticator apps)
router.post('/2fa/setup', ah(async (req, res) => {
  if (req.user.totp_enabled) throw bad('Two-step verification is already on.');
  const secret = authenticator.generateSecret();
  await q('UPDATE users SET totp_secret=$2 WHERE id=$1', [req.user.id, secret]);
  const club = await getSetting('club');
  const otpauth = authenticator.keyuri(req.user.email, club.name || 'MFlight', secret);
  res.json({ secret, qr: await QRCode.toDataURL(otpauth, { margin: 1, width: 220 }) });
}));

router.post('/2fa/enable', ah(async (req, res) => {
  const u = await reload(req.user.id);
  if (!u.totp_secret) throw bad('Start setup first.');
  if (!authenticator.check(str(req.body.code, 10).replace(/\s/g, ''), u.totp_secret)) throw bad('That code is not valid. Try the latest code from your app.');
  await q('UPDATE users SET totp_enabled=true WHERE id=$1', [u.id]);
  await audit(req, 'account.2fa_enabled', 'user', u.id);
  res.json({ user: await profileOut(await reload(u.id)) });
}));

router.post('/2fa/disable', ah(async (req, res) => {
  await checkPassword(req.user, req.body.password);
  await q('UPDATE users SET totp_enabled=false, totp_secret=NULL WHERE id=$1', [req.user.id]);
  await audit(req, 'account.2fa_disabled', 'user', req.user.id);
  res.json({ user: await profileOut(await reload(req.user.id)) });
}));

router.delete('/connections/:provider', ah(async (req, res) => {
  const col = { google: 'google_id', facebook: 'facebook_id' }[req.params.provider];
  if (!col) throw bad('Unknown provider.');
  const u = req.user;
  const others = (u.password_hash ? 1 : 0) + (u.google_id && col !== 'google_id' ? 1 : 0) + (u.facebook_id && col !== 'facebook_id' ? 1 : 0);
  if (!others) throw bad('Set a password first so you can still sign in after disconnecting.');
  await q(`UPDATE users SET ${col}=NULL WHERE id=$1`, [u.id]);
  res.json({ user: await profileOut(await reload(u.id)) });
}));

// Membership & billing
router.get('/orders', ah(async (req, res) => {
  const rows = await many('SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
  res.json({ orders: rows.map(orderOut) });
}));

router.post('/orders/:id/pay', ah(async (req, res) => {
  const o = await one("SELECT * FROM orders WHERE id=$1 AND user_id=$2 AND status='pending'", [req.params.id, req.user.id]);
  if (!o) throw bad('This order cannot be paid.');
  if (!(await stripeEnabled())) throw bad('Online payment is not available yet. The club will contact you about payment.');
  res.json({ url: await checkoutUrl(o, req.user, '/settings?tab=billing') });
}));

router.post('/membership/renew', ah(async (req, res) => {
  const tierId = str(req.body.tierId, 40) || req.user.tier_id;
  const tier = await one('SELECT * FROM tiers WHERE id=$1', [tierId]);
  if (!tier) throw bad('Choose a membership tier.');
  const order = await createOrder(req.user.id, { type: 'membership', refId: tier.id, description: `${tier.name} — 12 months`, amount: tier.price_yearly });
  await audit(req, 'membership.renew_requested', 'order', order.id, { tier: tier.id });
  let url = null;
  if (order.amount > 0 && (await stripeEnabled())) url = await checkoutUrl(order, req.user, '/settings?tab=billing');
  res.json({ order: orderOut(order), url });
}));

router.delete('/', ah(async (req, res) => {
  await checkPassword(req.user, req.body.password);
  if (str(req.body.confirm, 20) !== 'DELETE') throw bad('Type DELETE to confirm.');
  if (req.user.role === 'super_admin') {
    const n = await one("SELECT count(*)::int AS n FROM users WHERE role='super_admin'");
    if (n.n <= 1) throw bad('You are the only super admin. Make someone else super admin first.');
  }
  await audit(req, 'account.deleted', 'user', req.user.id, { email: req.user.email });
  await q('DELETE FROM users WHERE id=$1', [req.user.id]);
  clearSession(res);
  res.json({ ok: true });
}));
