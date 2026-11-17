import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { one, q, many, newId } from '../db.js';
import { requireArea, can, ROLES, ROLE_LABELS, PERMISSIONS } from '../auth.js';
import { userCounts, memberOut, carOut, postOut, POST_SELECT, eventsOut, listingOut, orderOut } from '../serialize.js';
import { getAllSettings, getSetting, maskSettings, putSetting, SUPER_ONLY_KEYS, DEFAULT_SETTINGS } from '../settings.js';
import { audit } from '../audit.js';
import { notify } from '../notify.js';
import { sendMail } from '../mailer.js';
import { chat } from '../ai.js';
import { markOrderPaid, refundOrder } from '../payments.js';
import { sendPasswordReset, nextMembershipNumber } from './auth.js';
import { promoteWaitlist } from './app.js';
import { ah, bad, notFound, forbidden, str, int, num, bool, EMAIL_RE, csv } from '../util.js';

export const router = Router();

const RANK = { super_admin: 4, admin: 3, chapter_lead: 2, moderator: 2, member: 1 };
const isLead = (u) => u.role === 'chapter_lead';

// ---------------------------------------------------------------- meta / overview
router.get('/meta', requireArea('overview'), ah(async (req, res) => {
  res.json({
    roles: ROLES.map((r) => ({ id: r, label: ROLE_LABELS[r], areas: PERMISSIONS[r] })),
    me: { role: req.user.role, areas: PERMISSIONS[req.user.role], chapterCountry: req.user.chapter_country },
    tiers: await many('SELECT id,name FROM tiers ORDER BY sort'),
    countries: (await many('SELECT name FROM geo_countries ORDER BY name')).map((r) => r.name),
  });
}));

router.get('/overview', requireArea('overview'), ah(async (req, res) => {
  const chapter = isLead(req.user) ? req.user.chapter_country : null;
  const s = await one(
    `SELECT
      (SELECT count(*)::int FROM users WHERE ($1::text IS NULL OR chapter_country=$1)) AS members,
      (SELECT count(*)::int FROM users WHERE status='Active' AND ($1::text IS NULL OR chapter_country=$1)) AS active,
      (SELECT count(*)::int FROM users WHERE status='Pending' AND ($1::text IS NULL OR chapter_country=$1)) AS pending_users,
      (SELECT count(*)::int FROM users WHERE created_at > now()-interval '30 days' AND ($1::text IS NULL OR chapter_country=$1)) AS new_30d,
      (SELECT count(*)::int FROM listings WHERE status='Pending') AS pending_listings,
      (SELECT count(*)::int FROM listings WHERE status='Active') AS active_listings,
      (SELECT count(*)::int FROM reports WHERE status='open') AS open_reports,
      (SELECT count(*)::int FROM events WHERE start_date >= current_date AND NOT cancelled) AS upcoming_events,
      (SELECT count(*)::int FROM cars) AS cars,
      (SELECT count(*)::int FROM posts WHERE created_at > now()-interval '30 days') AS posts_30d,
      (SELECT COALESCE(sum(amount),0) FROM orders WHERE status='paid') AS revenue,
      (SELECT COALESCE(sum(amount),0) FROM orders WHERE status='paid' AND paid_at > now()-interval '30 days') AS revenue_30d,
      (SELECT COALESCE(sum(amount),0) FROM orders WHERE status='pending') AS outstanding`,
    [chapter],
  );
  const signups = await many(
    `SELECT to_char(date_trunc('month', created_at),'YYYY-MM') AS month, count(*)::int AS n FROM users
     WHERE created_at > now()-interval '12 months' GROUP BY 1 ORDER BY 1`,
  );
  const revenueByMonth = await many(
    `SELECT to_char(date_trunc('month', paid_at),'YYYY-MM') AS month, sum(amount) AS total FROM orders
     WHERE status='paid' AND paid_at > now()-interval '12 months' GROUP BY 1 ORDER BY 1`,
  );
  const events = (await eventsOut(null, { includeUnpublished: true })).filter((e) => !e.cancelled && e.endDate >= new Date().toISOString().slice(0, 10)).slice(0, 6);
  const recent = await many(
    `SELECT a.*, u.first_name, u.last_name FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 8`,
  );
  res.json({ stats: s, signups, revenueByMonth, events, recent: recent.map(auditOut) });
}));

// ---------------------------------------------------------------- users
function adminUserOut(u, counts) {
  return {
    ...memberOut(u, counts, u),
    email: u.email,
    phone: u.phone,
    status: u.status,
    role: u.role,
    roleLabel: ROLE_LABELS[u.role],
    tierId: u.tier_id,
    chapterCountry: u.chapter_country,
    membershipExpires: u.membership_expires,
    emailVerified: u.email_verified,
    totpEnabled: u.totp_enabled,
    hasPassword: !!u.password_hash,
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
  };
}

function assertCanManage(actor, target) {
  if (actor.id === target.id) return;
  if (RANK[target.role] >= RANK[actor.role] && actor.role !== 'super_admin') throw forbidden('You cannot change a user at your own level or above.');
  if (isLead(actor) && target.chapter_country !== actor.chapter_country) throw forbidden('This member is outside your chapter.');
}

router.get('/users', requireArea('users'), ah(async (req, res) => {
  const chapter = isLead(req.user) ? req.user.chapter_country : null;
  const rows = await many(
    `SELECT * FROM users WHERE ($1::text IS NULL OR chapter_country=$1) ORDER BY created_at DESC`, [chapter],
  );
  const counts = await userCounts();
  res.json({ users: rows.map((u) => adminUserOut(u, counts)) });
}));

router.post('/users', requireArea('users'), ah(async (req, res) => {
  const b = req.body;
  const email = str(b.email, 200).toLowerCase();
  if (!EMAIL_RE.test(email)) throw bad('Enter a valid email.');
  if (!str(b.firstName)) throw bad('First name is required.');
  if (await one('SELECT 1 FROM users WHERE email=$1', [email])) throw bad('A user with that email already exists.');
  let role = ROLES.includes(b.role) ? b.role : 'member';
  if (RANK[role] >= RANK[req.user.role] && req.user.role !== 'super_admin') role = 'member';
  const chapter = isLead(req.user) ? req.user.chapter_country : str(b.chapterCountry, 80) || null;
  const id = newId('m');
  const pw = str(b.password, 200);
  await q(
    `INSERT INTO users(id,email,password_hash,role,status,first_name,last_name,membership_number,tier_id,chapter_country,location,verified,email_verified,membership_expires)
     VALUES ($1,$2,$3,$4,'Active',$5,$6,$7,$8,$9,$10,$11,true,current_date + interval '1 year')`,
    [id, email, pw ? await bcrypt.hash(pw, 10) : null, role, str(b.firstName, 60), str(b.lastName, 60), await nextMembershipNumber(),
      str(b.tierId, 40) || (await one('SELECT id FROM tiers WHERE is_default LIMIT 1'))?.id || null, chapter, str(b.location, 120), bool(b.verified)],
  );
  const user = await one('SELECT * FROM users WHERE id=$1', [id]);
  let invite = null;
  if (!pw) invite = await sendPasswordReset(user, { invited: true });
  await audit(req, 'user.created', 'user', id, { email, role });
  res.json({ user: adminUserOut(user, await userCounts([id])), inviteLink: invite && !invite.sent ? invite.link : null, emailed: !!invite?.sent });
}));

router.patch('/users/:id', requireArea('users'), ah(async (req, res) => {
  const u = await one('SELECT * FROM users WHERE id=$1', [req.params.id]);
  if (!u) throw notFound();
  assertCanManage(req.user, u);
  const b = req.body;
  const changes = {};
  if (b.role !== undefined && b.role !== u.role) {
    if (!ROLES.includes(b.role)) throw bad('Unknown role.');
    if (req.user.id === u.id) throw bad('You cannot change your own role.');
    if (req.user.role !== 'super_admin' && RANK[b.role] >= RANK[req.user.role]) throw forbidden('You cannot grant a role at your level or above.');
    if (u.role === 'super_admin') {
      const n = await one("SELECT count(*)::int AS n FROM users WHERE role='super_admin'");
      if (n.n <= 1) throw bad('There must be at least one super admin.');
    }
    changes.role = b.role;
  }
  if (b.status !== undefined) {
    if (!['Active', 'Pending', 'Suspended'].includes(b.status)) throw bad('Unknown status.');
    if (req.user.id === u.id && b.status !== 'Active') throw bad('You cannot suspend yourself.');
    changes.status = b.status;
  }
  if (b.tierId !== undefined) changes.tier_id = str(b.tierId, 40) || null;
  if (b.verified !== undefined) changes.verified = bool(b.verified);
  if (b.chapterCountry !== undefined && !isLead(req.user)) changes.chapter_country = str(b.chapterCountry, 80) || null;
  if (b.membershipExpires !== undefined) changes.membership_expires = str(b.membershipExpires, 10) || null;
  for (const [k, col] of [['firstName', 'first_name'], ['lastName', 'last_name'], ['location', 'location'], ['phone', 'phone']]) {
    if (b[k] !== undefined) changes[col] = str(b[k], 120);
  }
  if (b.email !== undefined) {
    const email = str(b.email, 200).toLowerCase();
    if (!EMAIL_RE.test(email)) throw bad('Enter a valid email.');
    if (await one('SELECT 1 FROM users WHERE email=$1 AND id<>$2', [email, u.id])) throw bad('Email already in use.');
    changes.email = email;
  }
  // Club position and the date someone actually joined the club: super admins only.
  if (b.clubPosition !== undefined || b.joinDate !== undefined) {
    if (req.user.role !== 'super_admin') throw forbidden('Only super admins can set club positions and join dates.');
    if (b.clubPosition !== undefined) {
      const pos = str(b.clubPosition, 60);
      const list = (await getSetting('positions'))?.list ?? [];
      if (pos && !list.includes(pos)) throw bad('Pick a position from the list (Settings → Club positions).');
      changes.club_position = pos || null;
    }
    if (b.joinDate !== undefined) {
      const d = str(b.joinDate, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) throw bad('Enter the join date as YYYY-MM-DD.');
      if (d > new Date().toISOString().slice(0, 10)) throw bad('The join date cannot be in the future.');
      changes.join_date = d;
    }
  }
  if (b.disable2fa) { changes.totp_enabled = false; changes.totp_secret = null; }
  const keys = Object.keys(changes);
  if (keys.length) {
    if (changes.status === 'Suspended' || changes.role) changes.token_version = u.token_version + 1;
    const cols = Object.keys(changes);
    await q(`UPDATE users SET ${cols.map((c, i) => `${c}=$${i + 2}`).join(', ')} WHERE id=$1`, [u.id, ...cols.map((c) => changes[c])]);
    if (changes.status === 'Active' && u.status === 'Pending') {
      await notify(u.id, 'Your membership is approved', 'Welcome aboard — your account is now fully active.', '/dashboard');
    }
    await audit(req, 'user.updated', 'user', u.id, { ...changes, totp_secret: undefined, token_version: undefined });
  }
  const fresh = await one('SELECT * FROM users WHERE id=$1', [u.id]);
  res.json({ user: adminUserOut(fresh, await userCounts([u.id])) });
}));

router.post('/users/:id/reset-password', requireArea('users'), ah(async (req, res) => {
  const u = await one('SELECT * FROM users WHERE id=$1', [req.params.id]);
  if (!u) throw notFound();
  assertCanManage(req.user, u);
  const r = await sendPasswordReset(u);
  await audit(req, 'user.reset_sent', 'user', u.id);
  res.json({ emailed: r.sent, link: r.sent ? null : r.link });
}));

router.post('/users/:id/signout', requireArea('users'), ah(async (req, res) => {
  const u = await one('SELECT * FROM users WHERE id=$1', [req.params.id]);
  if (!u) throw notFound();
  assertCanManage(req.user, u);
  await q('UPDATE users SET token_version=token_version+1 WHERE id=$1', [u.id]);
  await audit(req, 'user.signed_out', 'user', u.id);
  res.json({ ok: true });
}));

router.delete('/users/:id', requireArea('users'), ah(async (req, res) => {
  const u = await one('SELECT * FROM users WHERE id=$1', [req.params.id]);
  if (!u) throw notFound();
  if (u.id === req.user.id) throw bad('Delete your own account from Settings.');
  assertCanManage(req.user, u);
  if (isLead(req.user)) throw forbidden('Chapter leads cannot delete members. Suspend instead.');
  await q('DELETE FROM users WHERE id=$1', [u.id]);
  await audit(req, 'user.deleted', 'user', u.id, { email: u.email });
  res.json({ ok: true });
}));

router.get('/users.csv', requireArea('users'), ah(async (req, res) => {
  const chapter = isLead(req.user) ? req.user.chapter_country : null;
  const rows = await many('SELECT u.*, t.name AS tier_name FROM users u LEFT JOIN tiers t ON t.id=u.tier_id WHERE ($1::text IS NULL OR chapter_country=$1) ORDER BY membership_number', [chapter]);
  res.type('text/csv').attachment('members.csv').send(csv(rows, [
    { label: 'Membership #', get: (r) => r.membership_number }, { label: 'First name', get: (r) => r.first_name },
    { label: 'Last name', get: (r) => r.last_name }, { label: 'Email', get: (r) => r.email }, { label: 'Phone', get: (r) => r.phone },
    { label: 'Location', get: (r) => r.location }, { label: 'Chapter', get: (r) => r.chapter_country }, { label: 'Tier', get: (r) => r.tier_name },
    { label: 'Role', get: (r) => ROLE_LABELS[r.role] }, { label: 'Status', get: (r) => r.status },
    { label: 'Position', get: (r) => r.club_position || '' }, { label: 'Joined', get: (r) => r.join_date }, { label: 'Expires', get: (r) => r.membership_expires },
  ]));
}));

// ---------------------------------------------------------------- events
function eventFields(b, base = {}) {
  const f = {};
  const set = (k, col, v) => { if (b[k] !== undefined) f[col] = v; };
  set('title', 'title', str(b.title, 160));
  set('location', 'location', str(b.location, 160));
  set('country', 'country', str(b.country, 80) || null);
  set('nearestAirport', 'nearest_airport', str(b.nearestAirport, 8).toUpperCase());
  set('startDate', 'start_date', str(b.startDate, 10));
  set('endDate', 'end_date', str(b.endDate, 10));
  set('image', 'image', str(b.image, 300));
  set('category', 'category', str(b.category, 40));
  set('description', 'description', str(b.description, 5000));
  set('packagePrice', 'package_price', Math.max(0, num(b.packagePrice, 0)));
  set('perks', 'perks', JSON.stringify(Array.isArray(b.perks) ? b.perks.map((p) => str(p, 120)).filter(Boolean) : []));
  set('capacity', 'capacity', int(b.capacity, 40, 1, 100000));
  set('baseAttendees', 'base_attendees', int(b.baseAttendees, 0, 0, 100000));
  set('featured', 'featured', bool(b.featured));
  set('cancelled', 'cancelled', bool(b.cancelled));
  set('published', 'published', bool(b.published));
  const merged = { ...base, ...f };
  if (merged.start_date && merged.end_date && merged.end_date < merged.start_date) throw bad('End date must be on or after the start date.');
  return f;
}

async function eventInScope(user, id) {
  const e = await one('SELECT * FROM events WHERE id=$1', [id]);
  if (!e) throw notFound('Event not found.');
  if (isLead(user) && e.country !== user.chapter_country) throw forbidden('This event is outside your chapter.');
  return e;
}

router.get('/events', requireArea('events'), ah(async (req, res) => {
  let events = await eventsOut(null, { includeUnpublished: true });
  if (isLead(req.user)) events = events.filter((e) => e.country === req.user.chapter_country);
  const revenue = await many("SELECT ref_id, sum(amount) AS total FROM orders WHERE type='event' AND status='paid' GROUP BY ref_id");
  const rev = Object.fromEntries(revenue.map((r) => [r.ref_id, r.total]));
  res.json({ events: events.map((e) => ({ ...e, revenue: rev[e.id] || 0 })) });
}));

router.post('/events', requireArea('events'), ah(async (req, res) => {
  const f = eventFields({ published: true, ...req.body });
  if (!f.title || !f.location || !f.start_date || !f.end_date || !f.category) throw bad('Title, location, dates and category are required.');
  if (isLead(req.user)) f.country = req.user.chapter_country;
  if (!f.country) f.country = f.location.split(',').pop().trim();
  const id = `${f.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${crypto.randomBytes(2).toString('hex')}`;
  const cols = ['id', ...Object.keys(f)];
  await q(`INSERT INTO events(${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`, [id, ...Object.values(f)]);
  if (f.published !== false) await notify(null, `New event: ${f.title}`, `${f.location} · ${f.start_date}`, '/events');
  await audit(req, 'event.created', 'event', id, { title: f.title });
  const [ev] = await eventsOut(null, { includeUnpublished: true, id });
  res.json({ event: ev });
}));

router.patch('/events/:id', requireArea('events'), ah(async (req, res) => {
  const e = await eventInScope(req.user, req.params.id);
  const f = eventFields(req.body, e);
  if (isLead(req.user)) delete f.country;
  const cols = Object.keys(f);
  if (cols.length) {
    await q(`UPDATE events SET ${cols.map((c, i) => `${c}=$${i + 2}`).join(', ')} WHERE id=$1`, [e.id, ...cols.map((c) => f[c])]);
    if (f.cancelled === true && !e.cancelled) {
      const att = await many("SELECT user_id FROM rsvps WHERE event_id=$1 AND status IN ('going','waitlist')", [e.id]);
      for (const a of att) await notify(a.user_id, `Cancelled: ${e.title}`, 'This event has been cancelled. Paid bookings will be refunded by the club.', '/events');
    }
    if (f.capacity !== undefined && f.capacity > e.capacity) await promoteWaitlist(e.id);
    await audit(req, 'event.updated', 'event', e.id, f);
  }
  const [ev] = await eventsOut(null, { includeUnpublished: true, id: e.id });
  res.json({ event: ev });
}));

router.delete('/events/:id', requireArea('events'), ah(async (req, res) => {
  const e = await eventInScope(req.user, req.params.id);
  await q('DELETE FROM events WHERE id=$1', [e.id]);
  await audit(req, 'event.deleted', 'event', e.id, { title: e.title });
  res.json({ ok: true });
}));

const ATTENDEE_SQL = `
  SELECT r.*, u.first_name, u.last_name, u.email, u.phone, u.membership_number
  FROM rsvps r JOIN users u ON u.id=r.user_id WHERE r.event_id=$1 AND r.status<>'cancelled'
  ORDER BY r.status, r.created_at`;
const attendeeOut = (r) => ({
  id: r.id, userId: r.user_id, name: `${r.first_name} ${r.last_name}`.trim(), email: r.email, phone: r.phone,
  membershipNumber: r.membership_number, status: r.status, guests: r.guests, cars: r.cars, checkedIn: r.checked_in,
  paymentStatus: r.payment_status, amount: r.amount, notes: r.notes, createdAt: r.created_at,
});

router.get('/events/:id/attendees', requireArea('events'), ah(async (req, res) => {
  const e = await eventInScope(req.user, req.params.id);
  res.json({ attendees: (await many(ATTENDEE_SQL, [e.id])).map(attendeeOut) });
}));

router.get('/events/:id/attendees.csv', requireArea('events'), ah(async (req, res) => {
  const e = await eventInScope(req.user, req.params.id);
  const rows = (await many(ATTENDEE_SQL, [e.id])).map(attendeeOut);
  res.type('text/csv').attachment(`${e.id}-attendees.csv`).send(csv(rows, [
    { label: 'Name', get: (r) => r.name }, { label: 'Membership #', get: (r) => r.membershipNumber }, { label: 'Email', get: (r) => r.email },
    { label: 'Phone', get: (r) => r.phone }, { label: 'Status', get: (r) => r.status }, { label: 'Guests', get: (r) => r.guests },
    { label: 'Cars', get: (r) => r.cars }, { label: 'Payment', get: (r) => r.paymentStatus }, { label: 'Amount', get: (r) => r.amount },
    { label: 'Checked in', get: (r) => (r.checkedIn ? 'yes' : 'no') }, { label: 'Notes', get: (r) => r.notes },
  ]));
}));

router.patch('/events/:id/attendees/:rsvpId', requireArea('events'), ah(async (req, res) => {
  const e = await eventInScope(req.user, req.params.id);
  const r = await one('SELECT * FROM rsvps WHERE id=$1 AND event_id=$2', [req.params.rsvpId, e.id]);
  if (!r) throw notFound();
  const b = req.body;
  const f = {};
  if (b.checkedIn !== undefined) f.checked_in = bool(b.checkedIn);
  if (b.paymentStatus !== undefined && ['unpaid', 'paid', 'refunded', 'free'].includes(b.paymentStatus)) f.payment_status = b.paymentStatus;
  if (b.status !== undefined && ['going', 'waitlist', 'cancelled'].includes(b.status)) f.status = b.status;
  if (b.notes !== undefined) f.notes = str(b.notes, 500);
  const cols = Object.keys(f);
  if (cols.length) {
    await q(`UPDATE rsvps SET ${cols.map((c, i) => `${c}=$${i + 2}`).join(', ')}, updated_at=now() WHERE id=$1`, [r.id, ...cols.map((c) => f[c])]);
    if (f.payment_status === 'paid') {
      const o = await one("SELECT id FROM orders WHERE type='event' AND ref_id=$1 AND user_id=$2 AND status='pending' ORDER BY created_at DESC LIMIT 1", [e.id, r.user_id]);
      if (o) await markOrderPaid(o.id);
    }
    if (f.status === 'going' && r.status === 'waitlist') await notify(r.user_id, `You're in: ${e.title}`, 'Your waitlist place has been confirmed.', '/events');
    if (f.status === 'cancelled') await promoteWaitlist(e.id);
    await audit(req, 'rsvp.updated', 'rsvp', r.id, { event: e.id, ...f });
  }
  const fresh = await one(`${ATTENDEE_SQL.replace('WHERE r.event_id=$1', 'WHERE r.id=$2 AND r.event_id=$1')}`, [e.id, r.id]);
  res.json({ attendee: fresh ? attendeeOut(fresh) : null });
}));

router.post('/events/:id/message', requireArea('events'), ah(async (req, res) => {
  const e = await eventInScope(req.user, req.params.id);
  const title = str(req.body.title, 160) || `Update: ${e.title}`;
  const body = str(req.body.body, 2000);
  if (!body) throw bad('Write a message.');
  const att = await many("SELECT r.user_id, u.email, u.first_name, u.prefs FROM rsvps r JOIN users u ON u.id=r.user_id WHERE r.event_id=$1 AND r.status IN ('going','waitlist')", [e.id]);
  let emailed = 0;
  for (const a of att) {
    await notify(a.user_id, title, body, '/events');
    if (bool(req.body.email) && a.prefs?.emailNotifications !== false) {
      const r = await sendMail({ to: a.email, subject: title, text: `Hi ${a.first_name},\n\n${body}` });
      if (r.sent) emailed++;
    }
  }
  await audit(req, 'event.messaged', 'event', e.id, { recipients: att.length });
  res.json({ recipients: att.length, emailed });
}));

// ---------------------------------------------------------------- moderation
router.get('/reports', requireArea('moderation'), ah(async (req, res) => {
  const rows = await many(
    `SELECT r.*, u.first_name, u.last_name FROM reports r LEFT JOIN users u ON u.id=r.reporter_id
     WHERE ($1::text IS NULL OR r.status=$1) ORDER BY r.created_at DESC LIMIT 200`,
    [str(req.query.status) || null],
  );
  const out = [];
  for (const r of rows) {
    let preview = '';
    if (r.target_type === 'post') preview = (await one('SELECT text FROM posts WHERE id=$1', [r.target_id]))?.text;
    else if (r.target_type === 'comment') preview = (await one('SELECT text FROM comments WHERE id=$1', [r.target_id]))?.text;
    else if (r.target_type === 'listing') preview = (await one('SELECT title FROM listings WHERE id=$1', [r.target_id]))?.title;
    else if (r.target_type === 'user') { const u = await one('SELECT first_name,last_name FROM users WHERE id=$1', [r.target_id]); preview = u && `${u.first_name} ${u.last_name}`; }
    else if (r.target_type === 'car') preview = (await one("SELECT data->>'model' AS m FROM cars WHERE id=$1", [r.target_id]))?.m;
    else if (r.target_type === 'message') {
      // Only the reported message itself is shown to moderators — never the rest of the conversation.
      const m = await one("SELECT m.body, trim(u.first_name || ' ' || u.last_name) AS who FROM messages m LEFT JOIN users u ON u.id=m.sender_id WHERE m.id=$1", [r.target_id]);
      preview = m ? `${m.who}: ${m.body || '(deleted)'}` : '(deleted)';
    }
    out.push({ id: r.id, targetType: r.target_type, targetId: r.target_id, reason: r.reason, status: r.status, createdAt: r.created_at,
      reporterName: r.first_name ? `${r.first_name} ${r.last_name}` : 'Deleted user', preview: preview ?? '(content removed)' });
  }
  res.json({ reports: out });
}));

router.patch('/reports/:id', requireArea('moderation'), ah(async (req, res) => {
  const r = await one('SELECT * FROM reports WHERE id=$1', [req.params.id]);
  if (!r) throw notFound();
  const action = str(req.body.action, 20);
  if (action === 'hide') {
    const table = { post: 'posts', comment: 'comments', car: 'cars' }[r.target_type];
    if (table) await q(`UPDATE ${table} SET hidden=true WHERE id=$1`, [r.target_id]);
    if (r.target_type === 'listing') await q("UPDATE listings SET status='Rejected' WHERE id=$1", [r.target_id]);
    if (r.target_type === 'user') await q("UPDATE users SET status='Suspended', token_version=token_version+1 WHERE id=$1 AND role='member'", [r.target_id]);
    if (r.target_type === 'message') await q("UPDATE messages SET deleted_at=now(), body='', attachment=NULL WHERE id=$1", [r.target_id]);
  } else if (action === 'delete') {
    if (r.target_type === 'message') await q("UPDATE messages SET deleted_at=now(), body='', attachment=NULL WHERE id=$1", [r.target_id]);
    const table = { post: 'posts', comment: 'comments', car: 'cars', listing: 'listings' }[r.target_type];
    if (table) await q(`DELETE FROM ${table} WHERE id=$1`, [r.target_id]);
  }
  const status = ['resolved', 'dismissed', 'open'].includes(req.body.status) ? req.body.status : 'resolved';
  await q('UPDATE reports SET status=$2, resolved_by=$3 WHERE id=$1', [r.id, status, req.user.id]);
  await audit(req, 'report.' + status, 'report', r.id, { action, target: `${r.target_type}:${r.target_id}` });
  res.json({ ok: true });
}));

router.get('/posts', requireArea('moderation'), ah(async (req, res) => {
  const rows = await many(`${POST_SELECT} ORDER BY p.pinned DESC, p.created_at DESC LIMIT 300`, [req.user.id]);
  const comments = await many(
    `SELECT c.*, u.first_name, u.last_name FROM comments c JOIN users u ON u.id=c.author_id ORDER BY c.created_at DESC LIMIT 200`,
  );
  res.json({
    posts: rows.map(postOut),
    comments: comments.map((c) => ({ id: c.id, postId: c.post_id, authorId: c.author_id, authorName: `${c.first_name} ${c.last_name}`, text: c.text, hidden: c.hidden, createdAt: c.created_at })),
  });
}));

router.patch('/posts/:id', requireArea('moderation'), ah(async (req, res) => {
  const p = await one('SELECT * FROM posts WHERE id=$1', [req.params.id]);
  if (!p) throw notFound();
  const hidden = req.body.hidden !== undefined ? bool(req.body.hidden) : p.hidden;
  const pinned = req.body.pinned !== undefined ? bool(req.body.pinned) : p.pinned;
  await q('UPDATE posts SET hidden=$2, pinned=$3 WHERE id=$1', [p.id, hidden, pinned]);
  await audit(req, 'post.updated', 'post', p.id, { hidden, pinned });
  res.json({ post: postOut(await one(`${POST_SELECT} WHERE p.id=$2`, [req.user.id, p.id])) });
}));

router.delete('/posts/:id', requireArea('moderation'), ah(async (req, res) => {
  await q('DELETE FROM posts WHERE id=$1', [req.params.id]);
  await audit(req, 'post.deleted', 'post', req.params.id);
  res.json({ ok: true });
}));

router.patch('/comments/:id', requireArea('moderation'), ah(async (req, res) => {
  await q('UPDATE comments SET hidden=$2 WHERE id=$1', [req.params.id, bool(req.body.hidden)]);
  await audit(req, 'comment.updated', 'comment', req.params.id, { hidden: bool(req.body.hidden) });
  res.json({ ok: true });
}));

router.delete('/comments/:id', requireArea('moderation'), ah(async (req, res) => {
  await q('DELETE FROM comments WHERE id=$1', [req.params.id]);
  await audit(req, 'comment.deleted', 'comment', req.params.id);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- garages
router.get('/cars', requireArea('garages'), ah(async (_req, res) => {
  const rows = await many(`SELECT c.*, u.first_name, u.last_name, u.membership_number FROM cars c JOIN users u ON u.id=c.owner_id ORDER BY c.created_at DESC`);
  res.json({ cars: rows.map((r) => ({ ...carOut(r), ownerName: `${r.first_name} ${r.last_name}`, ownerNumber: r.membership_number, createdAt: r.created_at })) });
}));

router.patch('/cars/:id', requireArea('garages'), ah(async (req, res) => {
  const c = await one('SELECT * FROM cars WHERE id=$1', [req.params.id]);
  if (!c) throw notFound();
  const featured = req.body.featured !== undefined ? bool(req.body.featured) : c.featured;
  const hidden = req.body.hidden !== undefined ? bool(req.body.hidden) : c.hidden;
  if (featured && !c.featured) {
    await q('UPDATE cars SET featured=false WHERE featured');
    await notify(c.owner_id, 'Your car is Car of the Month', `Your ${c.data.model} is featured on the club feed.`, `/garage/${c.id}`);
  }
  await q('UPDATE cars SET featured=$2, hidden=$3 WHERE id=$1', [c.id, featured, hidden]);
  await audit(req, 'car.updated', 'car', c.id, { featured, hidden });
  res.json({ car: carOut(await one('SELECT * FROM cars WHERE id=$1', [c.id])) });
}));

router.delete('/cars/:id', requireArea('garages'), ah(async (req, res) => {
  await q('DELETE FROM cars WHERE id=$1', [req.params.id]);
  await audit(req, 'car.deleted', 'car', req.params.id);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- marketplace
router.get('/listings', requireArea('marketplace'), ah(async (_req, res) => {
  const rows = await many('SELECT * FROM listings ORDER BY listed_at DESC');
  res.json({ listings: rows.map(listingOut) });
}));

router.patch('/listings/:id', requireArea('marketplace'), ah(async (req, res) => {
  const l = await one('SELECT * FROM listings WHERE id=$1', [req.params.id]);
  if (!l) throw notFound();
  const status = str(req.body.status, 20);
  if (!['Active', 'Pending', 'Sold', 'Rejected'].includes(status)) throw bad('Unknown status.');
  await q('UPDATE listings SET status=$2 WHERE id=$1', [l.id, status]);
  if (status !== l.status && (status === 'Active' || status === 'Rejected')) {
    await notify(l.seller_id, status === 'Active' ? 'Listing approved' : 'Listing not approved', l.title, '/parts');
  }
  await audit(req, 'listing.status', 'listing', l.id, { from: l.status, to: status });
  res.json({ listing: listingOut(await one('SELECT * FROM listings WHERE id=$1', [l.id])) });
}));

router.delete('/listings/:id', requireArea('marketplace'), ah(async (req, res) => {
  await q('DELETE FROM listings WHERE id=$1', [req.params.id]);
  await audit(req, 'listing.deleted', 'listing', req.params.id);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- orders & payments
const ORDER_SQL = `SELECT o.*, (u.first_name || ' ' || u.last_name) AS user_name, u.email AS user_email
  FROM orders o LEFT JOIN users u ON u.id=o.user_id`;

router.get('/orders', requireArea('orders'), ah(async (_req, res) => {
  const rows = await many(`${ORDER_SQL} ORDER BY o.created_at DESC LIMIT 1000`);
  res.json({ orders: rows.map(orderOut) });
}));

router.get('/orders.csv', requireArea('orders'), ah(async (_req, res) => {
  const rows = (await many(`${ORDER_SQL} ORDER BY o.created_at DESC`)).map(orderOut);
  res.type('text/csv').attachment('orders.csv').send(csv(rows, [
    { label: 'Order', get: (r) => r.id }, { label: 'Date', get: (r) => r.createdAt }, { label: 'Member', get: (r) => r.userName },
    { label: 'Email', get: (r) => r.userEmail }, { label: 'Type', get: (r) => r.type }, { label: 'Description', get: (r) => r.description },
    { label: 'Amount', get: (r) => r.amount }, { label: 'Currency', get: (r) => r.currency }, { label: 'Status', get: (r) => r.status },
    { label: 'Provider', get: (r) => r.provider }, { label: 'Paid at', get: (r) => r.paidAt },
  ]));
}));

router.post('/orders/:id/mark-paid', requireArea('orders'), ah(async (req, res) => {
  await markOrderPaid(req.params.id);
  await audit(req, 'order.marked_paid', 'order', req.params.id);
  res.json({ order: orderOut(await one(`${ORDER_SQL} WHERE o.id=$1`, [req.params.id])) });
}));

router.post('/orders/:id/refund', requireArea('orders'), ah(async (req, res) => {
  if (!(await refundOrder(req.params.id))) throw notFound();
  await audit(req, 'order.refunded', 'order', req.params.id);
  res.json({ order: orderOut(await one(`${ORDER_SQL} WHERE o.id=$1`, [req.params.id])) });
}));

router.post('/orders/:id/cancel', requireArea('orders'), ah(async (req, res) => {
  await q("UPDATE orders SET status='cancelled' WHERE id=$1 AND status='pending'", [req.params.id]);
  await audit(req, 'order.cancelled', 'order', req.params.id);
  res.json({ order: orderOut(await one(`${ORDER_SQL} WHERE o.id=$1`, [req.params.id])) });
}));

// ---------------------------------------------------------------- announcements
router.get('/announcements', requireArea('announcements'), ah(async (_req, res) => {
  const rows = await many(`SELECT a.*, u.first_name, u.last_name FROM announcements a LEFT JOIN users u ON u.id=a.sent_by ORDER BY a.created_at DESC LIMIT 100`);
  res.json({ announcements: rows.map((a) => ({ id: a.id, title: a.title, body: a.body, audience: a.audience, channels: a.channels, recipients: a.recipients, createdAt: a.created_at, sentBy: a.first_name ? `${a.first_name} ${a.last_name}` : '—' })) });
}));

router.post('/announcements', requireArea('announcements'), ah(async (req, res) => {
  const title = str(req.body.title, 160);
  const body = str(req.body.body, 5000);
  if (!title || !body) throw bad('Title and message are required.');
  let audience = req.body.audience || { type: 'all' };
  if (isLead(req.user)) audience = { type: 'chapter', value: req.user.chapter_country };
  const channels = { inApp: req.body.channels?.inApp !== false, email: !!req.body.channels?.email, feed: !!req.body.channels?.feed && !isLead(req.user) };
  let where = "status='Active'";
  const params = [];
  if (audience.type === 'tier') { where += ' AND tier_id=$1'; params.push(audience.value); }
  else if (audience.type === 'chapter') { where += ' AND chapter_country=$1'; params.push(audience.value); }
  else if (audience.type === 'role') { where += ' AND role=$1'; params.push(audience.value); }
  else audience = { type: 'all' };
  const users = await many(`SELECT id,email,first_name,prefs FROM users WHERE ${where}`, params);

  let emailed = 0;
  if (channels.inApp) {
    if (audience.type === 'all') await notify(null, title, body.slice(0, 280), '/dashboard');
    else for (const u of users) await notify(u.id, title, body.slice(0, 280), '/dashboard');
  }
  if (channels.email) {
    for (const u of users) {
      if (u.prefs?.emailNotifications === false) continue;
      const r = await sendMail({ to: u.email, subject: title, text: `Hi ${u.first_name},\n\n${body}` });
      if (r.sent) emailed++;
    }
  }
  if (channels.feed) {
    await q('INSERT INTO posts(id,author_id,text,is_announcement,pinned,kind) VALUES ($1,$2,$3,true,true,$4)',
      [newId('post'), req.user.id, `${title}\n\n${body}`, 'announcement']);
  }
  const id = newId('ann');
  await q('INSERT INTO announcements(id,title,body,audience,channels,recipients,sent_by) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, title, body, audience, channels, users.length, req.user.id]);
  await audit(req, 'announcement.sent', 'announcement', id, { audience, recipients: users.length, emailed });
  res.json({ id, recipients: users.length, emailed });
}));

// ---------------------------------------------------------------- audit log
function auditOut(a) {
  return { id: String(a.id), action: a.action, targetType: a.target_type, targetId: a.target_id, details: a.details, ip: a.ip,
    createdAt: a.created_at, actorName: a.first_name ? `${a.first_name} ${a.last_name}` : 'System' };
}

router.get('/audit', requireArea('audit'), ah(async (req, res) => {
  const rows = await many(
    `SELECT a.*, u.first_name, u.last_name FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id
     WHERE ($1::text IS NULL OR a.action ILIKE $1 || '%') ORDER BY a.created_at DESC LIMIT $2`,
    [str(req.query.action) || null, int(req.query.limit, 300, 1, 2000)],
  );
  res.json({ entries: rows.map(auditOut) });
}));

// ---------------------------------------------------------------- settings
router.get('/settings', requireArea('settings'), ah(async (req, res) => {
  const all = maskSettings(await getAllSettings());
  if (req.user.role !== 'super_admin') for (const k of SUPER_ONLY_KEYS) delete all[k];
  const tiers = await many('SELECT * FROM tiers ORDER BY sort');
  const geo = await many('SELECT * FROM geo_countries ORDER BY name');
  const cities = await many('SELECT * FROM geo_cities ORDER BY country, city');
  res.json({
    settings: all,
    superOnly: SUPER_ONLY_KEYS,
    tiers: tiers.map((t) => ({ id: t.id, name: t.name, priceYearly: t.price_yearly, benefits: t.benefits, color: t.color, sort: t.sort, isDefault: t.is_default,
      members: 0 })),
    tierCounts: Object.fromEntries((await many('SELECT tier_id, count(*)::int AS n FROM users GROUP BY tier_id')).map((r) => [r.tier_id, r.n])),
    geo: geo.map((g) => ({ isoA3: g.iso_a3, isoN: g.iso_n, name: g.name, members: g.members, chapters: g.chapters, continent: g.continent, growth: g.growth })),
    cities: cities.map((c) => ({ id: c.id, city: c.city, country: c.country, members: c.members, lon: c.lon, lat: c.lat })),
    oauthRedirects: {
      google: `${process.env.APP_URL || ''}/api/auth/oauth/google/callback`,
      facebook: `${process.env.APP_URL || ''}/api/auth/oauth/facebook/callback`,
      stripeWebhook: `${process.env.APP_URL || ''}/api/payments/stripe/webhook`,
    },
  });
}));

router.put('/settings/:key', requireArea('settings'), ah(async (req, res) => {
  const key = req.params.key;
  if (!DEFAULT_SETTINGS[key]) throw bad('Unknown settings section.');
  if (SUPER_ONLY_KEYS.includes(key) && req.user.role !== 'super_admin') throw forbidden('Only super admins can change this section.');
  const allowed = Object.keys(DEFAULT_SETTINGS[key]);
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
  if (key === 'positions') {
    const seen = new Set();
    patch.list = (Array.isArray(patch.list) ? patch.list : [])
      .map((x) => String(x ?? '').trim().slice(0, 60))
      .filter((x) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()))
      .slice(0, 40);
  }
  const next = await putSetting(key, patch);
  await audit(req, 'settings.updated', 'settings', key, { fields: Object.keys(patch) });
  res.json({ value: maskSettings({ [key]: next })[key] });
}));

router.post('/settings/test-email', requireArea('settings'), ah(async (req, res) => {
  const r = await sendMail({ to: req.user.email, subject: 'MFlight test email', text: 'SMTP is working. This is a test message from your MFlight admin settings.' });
  res.json(r);
}));

router.post('/settings/test-ai', requireArea('settings'), ah(async (_req, res) => {
  const reply = await chat([{ role: 'user', content: 'Reply with exactly: MFlight AI connected.' }], { maxTokens: 20 });
  res.json({ reply });
}));

// Tiers
router.post('/tiers', requireArea('settings'), ah(async (req, res) => {
  const name = str(req.body.name, 60);
  if (!name) throw bad('Tier name is required.');
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || newId('tier');
  if (await one('SELECT 1 FROM tiers WHERE id=$1', [id])) throw bad('A tier with that name already exists.');
  const sort = (await one('SELECT COALESCE(max(sort),0)+1 AS s FROM tiers')).s;
  await q('INSERT INTO tiers(id,name,price_yearly,benefits,color,sort) VALUES ($1,$2,$3,$4,$5,$6)',
    [id, name, Math.max(0, num(req.body.priceYearly, 0)), JSON.stringify((req.body.benefits || []).map((b) => str(b, 120)).filter(Boolean)), str(req.body.color, 9) || '#1C69D4', sort]);
  await audit(req, 'tier.created', 'tier', id);
  res.json({ ok: true, id });
}));

router.patch('/tiers/:id', requireArea('settings'), ah(async (req, res) => {
  const t = await one('SELECT * FROM tiers WHERE id=$1', [req.params.id]);
  if (!t) throw notFound();
  const b = req.body;
  if (bool(b.isDefault)) await q('UPDATE tiers SET is_default=false');
  await q('UPDATE tiers SET name=$2, price_yearly=$3, benefits=$4, color=$5, sort=$6, is_default=$7 WHERE id=$1', [
    t.id, b.name !== undefined ? str(b.name, 60) || t.name : t.name, b.priceYearly !== undefined ? Math.max(0, num(b.priceYearly, 0)) : t.price_yearly,
    JSON.stringify(Array.isArray(b.benefits) ? b.benefits.map((x) => str(x, 120)).filter(Boolean) : t.benefits),
    b.color !== undefined ? str(b.color, 9) : t.color, b.sort !== undefined ? int(b.sort, t.sort) : t.sort,
    b.isDefault !== undefined ? bool(b.isDefault) : t.is_default,
  ]);
  await audit(req, 'tier.updated', 'tier', t.id);
  res.json({ ok: true });
}));

router.delete('/tiers/:id', requireArea('settings'), ah(async (req, res) => {
  const n = await one('SELECT count(*)::int AS n FROM users WHERE tier_id=$1', [req.params.id]);
  if (n.n > 0) throw bad(`${n.n} member${n.n === 1 ? ' is' : 's are'} on this tier. Move them to another tier first.`);
  await q('DELETE FROM tiers WHERE id=$1', [req.params.id]);
  await audit(req, 'tier.deleted', 'tier', req.params.id);
  res.json({ ok: true });
}));

// Chapters & map data
router.put('/geo/:iso', requireArea('settings'), ah(async (req, res) => {
  const b = req.body;
  const iso = str(req.params.iso, 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(iso)) throw bad('Use a 3-letter ISO country code (e.g. DEU).');
  if (!/^\d{3}$/.test(str(b.isoN))) throw bad('Use the 3-digit ISO numeric code (e.g. 276).');
  await q(
    `INSERT INTO geo_countries(iso_a3,iso_n,name,members,chapters,continent,growth) VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (iso_a3) DO UPDATE SET iso_n=$2, name=$3, members=$4, chapters=$5, continent=$6, growth=$7`,
    [iso, str(b.isoN, 3), str(b.name, 80), int(b.members, 0, 0), int(b.chapters, 0, 0), str(b.continent, 40) || 'Europe', num(b.growth, 0)],
  );
  await audit(req, 'geo.saved', 'country', iso);
  res.json({ ok: true });
}));

router.delete('/geo/:iso', requireArea('settings'), ah(async (req, res) => {
  await q('DELETE FROM geo_countries WHERE iso_a3=$1', [req.params.iso]);
  await audit(req, 'geo.deleted', 'country', req.params.iso);
  res.json({ ok: true });
}));

router.post('/cities', requireArea('settings'), ah(async (req, res) => {
  const b = req.body;
  if (!str(b.city) || !str(b.country)) throw bad('City and country are required.');
  const lon = num(b.lon, NaN), lat = num(b.lat, NaN);
  if (!(lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90)) throw bad('Enter valid coordinates.');
  const r = await one('INSERT INTO geo_cities(city,country,members,lon,lat) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [str(b.city, 80), str(b.country, 80), int(b.members, 0, 0), lon, lat]);
  await audit(req, 'city.created', 'city', String(r.id));
  res.json({ ok: true, id: r.id });
}));

router.patch('/cities/:id', requireArea('settings'), ah(async (req, res) => {
  const c = await one('SELECT * FROM geo_cities WHERE id=$1', [int(req.params.id)]);
  if (!c) throw notFound();
  const b = req.body;
  await q('UPDATE geo_cities SET city=$2,country=$3,members=$4,lon=$5,lat=$6 WHERE id=$1', [
    c.id, b.city !== undefined ? str(b.city, 80) : c.city, b.country !== undefined ? str(b.country, 80) : c.country,
    b.members !== undefined ? int(b.members, 0, 0) : c.members, b.lon !== undefined ? num(b.lon, c.lon) : c.lon, b.lat !== undefined ? num(b.lat, c.lat) : c.lat,
  ]);
  res.json({ ok: true });
}));

router.delete('/cities/:id', requireArea('settings'), ah(async (req, res) => {
  await q('DELETE FROM geo_cities WHERE id=$1', [int(req.params.id)]);
  await audit(req, 'city.deleted', 'city', req.params.id);
  res.json({ ok: true });
}));

export { can };
