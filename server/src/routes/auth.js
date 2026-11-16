import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { authenticator } from 'otplib';
import rateLimit from 'express-rate-limit';
import { one, q, newId } from '../db.js';
import { config } from '../config.js';
import { getSetting } from '../settings.js';
import { issueSession, clearSession } from '../auth.js';
import { profileOut } from '../serialize.js';
import { sendMail } from '../mailer.js';
import { audit } from '../audit.js';
import { notify } from '../notify.js';
import { ah, bad, EMAIL_RE, sha256, randomToken, str } from '../util.js';

export const router = Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' } });

export async function nextMembershipNumber(client = { query: q }) {
  const m = await getSetting('membership');
  const prefix = m.numberPrefix || 'MFC-';
  const r = await client.query(
    `SELECT COALESCE(max(NULLIF(regexp_replace(membership_number,'\\D','','g'),'')::int),0)+1 AS n FROM users`,
  );
  return `${prefix}${String(r.rows[0].n).padStart(5, '0')}`;
}

async function defaultTierId() {
  const t = await one('SELECT id FROM tiers WHERE is_default ORDER BY sort LIMIT 1');
  return t?.id ?? null;
}

async function sendVerification(user) {
  const token = randomToken();
  await q("INSERT INTO tokens(token_hash,user_id,kind,expires_at) VALUES ($1,$2,'verify',now()+interval '3 days')", [sha256(token), user.id]);
  const club = await getSetting('club');
  return sendMail({
    to: user.email,
    subject: `Confirm your ${club.name} email`,
    text: `Hi ${user.first_name},\n\nConfirm your email address to activate your ${club.name} account:\n${config.appUrl}/api/auth/verify?token=${token}\n\nThis link expires in 3 days.`,
  });
}

export async function sendPasswordReset(user, { invited = false } = {}) {
  const token = randomToken();
  await q("INSERT INTO tokens(token_hash,user_id,kind,expires_at) VALUES ($1,$2,'reset',now()+interval '2 days')", [sha256(token), user.id]);
  const club = await getSetting('club');
  const link = `${config.appUrl}/reset-password?token=${token}`;
  const mail = await sendMail({
    to: user.email,
    subject: invited ? `You're invited to ${club.name}` : `Reset your ${club.name} password`,
    text: invited
      ? `Hi ${user.first_name},\n\nAn account has been created for you on ${club.name} (${club.clubName}). Set your password here:\n${link}\n\nThis link expires in 2 days.`
      : `Hi ${user.first_name},\n\nUse this link to set a new password:\n${link}\n\nThis link expires in 2 days. If you did not request it, ignore this email.`,
  });
  return { ...mail, link };
}

router.get('/me', ah(async (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: await profileOut(req.user) });
}));

router.post('/signup', limiter, ah(async (req, res) => {
  const authS = await getSetting('auth');
  if (!authS.allowSignup) throw bad('New sign-ups are currently closed. Contact the club to join.');
  const firstName = str(req.body.firstName, 60);
  const lastName = str(req.body.lastName, 60);
  const email = str(req.body.email, 200).toLowerCase();
  const password = String(req.body.password || '');
  if (!firstName) throw bad('Enter your first name.');
  if (!EMAIL_RE.test(email)) throw bad('Enter a valid email address.');
  if (password.length < 8) throw bad('Password must be at least 8 characters.');
  if (await one('SELECT 1 FROM users WHERE email=$1', [email])) throw bad('An account with this email already exists. Sign in instead.');

  const id = newId('m');
  const status = authS.requireApproval ? 'Pending' : 'Active';
  await q(
    `INSERT INTO users(id,email,password_hash,status,first_name,last_name,membership_number,tier_id,location,email_verified)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, email, await bcrypt.hash(password, 10), status, firstName, lastName, await nextMembershipNumber(), await defaultTierId(),
      str(req.body.location, 120), !authS.requireEmailVerification],
  );
  const user = await one('SELECT * FROM users WHERE id=$1', [id]);
  if (authS.requireEmailVerification) await sendVerification(user);
  await notify(id, 'Welcome to the club', 'Add your car to the garage and RSVP to your first event.', '/garage');
  await audit({ user, ip: req.ip }, 'user.signup', 'user', id, { status });
  issueSession(res, user);
  res.json({ user: await profileOut(user) });
}));

router.post('/login', limiter, ah(async (req, res) => {
  const email = str(req.body.email, 200).toLowerCase();
  const password = String(req.body.password || '');
  const user = await one('SELECT * FROM users WHERE email=$1', [email]);
  if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    throw bad('Email or password is incorrect.');
  }
  if (user.status === 'Suspended') throw bad('This account is suspended. Contact the club for help.');
  if (user.totp_enabled) {
    const code = str(req.body.code, 10).replace(/\s/g, '');
    if (!code) return res.json({ needTotp: true });
    if (!authenticator.check(code, user.totp_secret)) throw bad('That two-step code is not valid. Try the latest code.');
  }
  await q('UPDATE users SET last_login_at=now() WHERE id=$1', [user.id]);
  issueSession(res, user, req.body.remember !== false);
  await audit({ user, ip: req.ip }, 'user.login', 'user', user.id);
  res.json({ user: await profileOut(user) });
}));

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.post('/forgot', limiter, ah(async (req, res) => {
  const email = str(req.body.email, 200).toLowerCase();
  const user = await one('SELECT * FROM users WHERE email=$1', [email]);
  if (user && user.status !== 'Suspended') await sendPasswordReset(user);
  res.json({ ok: true }); // never reveal whether the email exists
}));

router.post('/reset', limiter, ah(async (req, res) => {
  const token = String(req.body.token || '');
  const password = String(req.body.password || '');
  if (password.length < 8) throw bad('Password must be at least 8 characters.');
  const t = await one("SELECT * FROM tokens WHERE token_hash=$1 AND kind='reset' AND NOT used AND expires_at>now()", [sha256(token)]);
  if (!t) throw bad('This reset link is invalid or has expired. Request a new one.');
  await q('UPDATE tokens SET used=true WHERE token_hash=$1', [t.token_hash]);
  const user = await one(
    'UPDATE users SET password_hash=$2, email_verified=true, token_version=token_version+1 WHERE id=$1 RETURNING *',
    [t.user_id, await bcrypt.hash(password, 10)],
  );
  await audit({ user, ip: req.ip }, 'user.password_reset', 'user', user.id);
  issueSession(res, user);
  res.json({ user: await profileOut(user) });
}));

router.get('/verify', ah(async (req, res) => {
  const t = await one("SELECT * FROM tokens WHERE token_hash=$1 AND kind='verify' AND NOT used AND expires_at>now()", [sha256(String(req.query.token || ''))]);
  if (!t) return res.redirect('/login?verified=0');
  await q('UPDATE tokens SET used=true WHERE token_hash=$1', [t.token_hash]);
  await q('UPDATE users SET email_verified=true WHERE id=$1', [t.user_id]);
  res.redirect('/dashboard?verified=1');
}));

router.post('/resend-verification', ah(async (req, res) => {
  if (!req.user) throw bad('Please sign in.');
  if (req.user.email_verified) return res.json({ ok: true });
  const r = await sendVerification(req.user);
  res.json({ ok: true, sent: r.sent });
}));

// ---------------------------------------------------------------------------
// OAuth (Google / Facebook)
// ---------------------------------------------------------------------------
const PROVIDERS = {
  google: {
    enabled: (s) => s.googleEnabled && s.googleClientId && s.googleClientSecret,
    authUrl: (s, redirect, state) =>
      `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: s.googleClientId, redirect_uri: redirect, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account',
      })}`,
    async profile(s, redirect, code) {
      const tok = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: s.googleClientId, client_secret: s.googleClientSecret, redirect_uri: redirect, grant_type: 'authorization_code' }),
      }).then((r) => r.json());
      if (!tok.access_token) throw new Error(tok.error_description || 'Google sign-in failed');
      const p = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json());
      return { id: p.sub, email: p.email_verified ? p.email : null, firstName: p.given_name || p.name || 'Member', lastName: p.family_name || '' };
    },
    column: 'google_id',
  },
  facebook: {
    enabled: (s) => s.facebookEnabled && s.facebookAppId && s.facebookAppSecret,
    authUrl: (s, redirect, state) =>
      `https://www.facebook.com/v19.0/dialog/oauth?${new URLSearchParams({ client_id: s.facebookAppId, redirect_uri: redirect, state, scope: 'email,public_profile' })}`,
    async profile(s, redirect, code) {
      const tok = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({
        client_id: s.facebookAppId, client_secret: s.facebookAppSecret, redirect_uri: redirect, code })}`).then((r) => r.json());
      if (!tok.access_token) throw new Error(tok.error?.message || 'Facebook sign-in failed');
      const p = await fetch(`https://graph.facebook.com/me?fields=id,first_name,last_name,email&access_token=${encodeURIComponent(tok.access_token)}`).then((r) => r.json());
      return { id: p.id, email: p.email || null, firstName: p.first_name || 'Member', lastName: p.last_name || '' };
    },
    column: 'facebook_id',
  },
};

const redirectUri = (p) => `${config.appUrl}/api/auth/oauth/${p}/callback`;

router.get('/oauth/:provider/start', ah(async (req, res) => {
  const p = PROVIDERS[req.params.provider];
  const s = await getSetting('auth');
  if (!p || !p.enabled(s)) return res.redirect('/login?oauth=disabled');
  const nonce = crypto.randomBytes(16).toString('hex');
  const mode = req.query.mode === 'link' && req.user ? 'link' : 'login';
  const state = jwt.sign({ nonce, mode, uid: mode === 'link' ? req.user.id : null }, config.jwtSecret, { expiresIn: '10m' });
  res.cookie('mflight_oauth', nonce, { httpOnly: true, sameSite: 'lax', secure: config.secureCookies, maxAge: 600000, path: '/' });
  res.redirect(p.authUrl(s, redirectUri(req.params.provider), state));
}));

router.get('/oauth/:provider/callback', ah(async (req, res) => {
  const name = req.params.provider;
  const p = PROVIDERS[name];
  const s = await getSetting('auth');
  if (!p || !p.enabled(s)) return res.redirect('/login?oauth=disabled');
  let state;
  try {
    state = jwt.verify(String(req.query.state || ''), config.jwtSecret);
  } catch {
    return res.redirect('/login?oauth=failed');
  }
  if (!state.nonce || state.nonce !== req.cookies.mflight_oauth) return res.redirect('/login?oauth=failed');
  res.clearCookie('mflight_oauth', { path: '/' });
  if (!req.query.code) return res.redirect(state.mode === 'link' ? '/settings?tab=connections' : '/login?oauth=cancelled');

  let prof;
  try {
    prof = await p.profile(s, redirectUri(name), String(req.query.code));
  } catch (e) {
    console.error('[oauth]', e.message);
    return res.redirect('/login?oauth=failed');
  }

  if (state.mode === 'link') {
    const taken = await one(`SELECT id FROM users WHERE ${p.column}=$1`, [prof.id]);
    if (taken && taken.id !== state.uid) return res.redirect('/settings?tab=connections&link=taken');
    await q(`UPDATE users SET ${p.column}=$2 WHERE id=$1`, [state.uid, prof.id]);
    return res.redirect('/settings?tab=connections&link=ok');
  }

  let user = await one(`SELECT * FROM users WHERE ${p.column}=$1`, [prof.id]);
  if (!user && prof.email) {
    user = await one('SELECT * FROM users WHERE email=$1', [prof.email.toLowerCase()]);
    if (user) user = await one(`UPDATE users SET ${p.column}=$2, email_verified=true WHERE id=$1 RETURNING *`, [user.id, prof.id]);
  }
  if (!user) {
    if (!s.allowSignup) return res.redirect('/login?oauth=closed');
    if (!prof.email) return res.redirect('/login?oauth=noemail');
    const id = newId('m');
    user = await one(
      `INSERT INTO users(id,email,status,first_name,last_name,membership_number,tier_id,email_verified,${p.column})
       VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8) RETURNING *`,
      [id, prof.email.toLowerCase(), s.requireApproval ? 'Pending' : 'Active', prof.firstName, prof.lastName,
        await nextMembershipNumber(), await defaultTierId(), prof.id],
    );
    await audit({ user, ip: req.ip }, 'user.signup', 'user', id, { via: name });
  }
  if (user.status === 'Suspended') return res.redirect('/login?oauth=suspended');
  if (user.totp_enabled) return res.redirect('/login?oauth=totp'); // 2FA users sign in with password + code
  await q('UPDATE users SET last_login_at=now() WHERE id=$1', [user.id]);
  issueSession(res, user);
  res.redirect('/dashboard');
}));
