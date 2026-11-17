import { Router } from 'express';
import { one, q, many, newId } from '../db.js';
import { requireAuth } from '../auth.js';
import {
  userCounts, memberOut, profileOut, carOut, postOut, POST_SELECT, eventsOut, rsvpOut, listingOut, orderOut, timeAgoShort,
} from '../serialize.js';
import { getSetting, publicSettings } from '../settings.js';
import { upload } from '../uploads.js';
import { notify } from '../notify.js';
import { audit } from '../audit.js';
import { carInsights } from '../ai.js';
import { createOrder, checkoutUrl, stripeEnabled, confirmStripeSession } from '../payments.js';
import { ah, bad, notFound, forbidden, str, int, num } from '../util.js';

export const router = Router();

router.get('/settings/public', ah(async (_req, res) => res.json(await publicSettings())));

router.get('/payments/stripe/return', ah(async (req, res) => {
  const next = String(req.query.next || '/dashboard');
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  let ok = false;
  try {
    ok = await confirmStripeSession(String(req.query.session_id || ''));
  } catch (e) {
    console.error('[stripe return]', e.message);
  }
  res.redirect(`${safeNext}${safeNext.includes('?') ? '&' : '?'}payment=${ok ? 'success' : 'pending'}`);
}));

// Everything below needs a signed-in member.
router.use(requireAuth);

async function notificationsFor(user) {
  const rows = await many(
    `SELECT n.*, EXISTS(SELECT 1 FROM notification_reads r WHERE r.notification_id=n.id AND r.user_id=$1) AS read
     FROM notifications n WHERE n.user_id=$1 OR n.user_id IS NULL ORDER BY n.created_at DESC LIMIT 30`,
    [user.id],
  );
  return rows.map((n) => ({ id: String(n.id), title: n.title, body: n.body, link: n.link, time: timeAgoShort(n.created_at), unread: !n.read }));
}

router.get('/bootstrap', ah(async (req, res) => {
  const me = req.user;
  const [users, counts, cars, posts, events, rsvps, listings, notifications, geo, cities, tiers, settings] = await Promise.all([
    many("SELECT * FROM users WHERE status<>'Suspended' ORDER BY join_date"),
    userCounts(),
    many(
      `SELECT c.* FROM cars c JOIN users u ON u.id=c.owner_id
       WHERE NOT c.hidden AND (c.owner_id=$1 OR COALESCE((u.privacy->>'publicGarage')::boolean, true)) ORDER BY c.created_at`,
      [me.id],
    ),
    many(`${POST_SELECT} WHERE NOT p.hidden ORDER BY p.pinned DESC, p.created_at DESC LIMIT 100`, [me.id]),
    eventsOut(me.id),
    many('SELECT * FROM rsvps WHERE user_id=$1', [me.id]),
    many("SELECT * FROM listings WHERE status IN ('Active','Sold') OR seller_id=$1 ORDER BY listed_at DESC", [me.id]),
    notificationsFor(me),
    many('SELECT * FROM geo_countries ORDER BY members DESC'),
    many('SELECT * FROM geo_cities ORDER BY members DESC'),
    many('SELECT * FROM tiers ORDER BY sort'),
    publicSettings(),
  ]);
  res.json({
    profile: await profileOut(me),
    members: users.map((u) => memberOut(u, counts, me)),
    cars: cars.map(carOut),
    posts: posts.map(postOut),
    events,
    rsvps: Object.fromEntries(rsvps.filter((r) => r.status !== 'cancelled').map((r) => [r.event_id, rsvpOut(r)])),
    listings: listings.map(listingOut),
    notifications,
    geo: geo.map((g) => ({ isoA3: g.iso_a3, isoN: g.iso_n, name: g.name, members: g.members, chapters: g.chapters, continent: g.continent, growth: g.growth })),
    cities: cities.map((c) => ({ city: c.city, country: c.country, members: c.members, coordinates: [c.lon, c.lat] })),
    tiers: tiers.map((t) => ({ id: t.id, name: t.name, priceYearly: t.price_yearly, benefits: t.benefits, color: t.color, isDefault: t.is_default })),
    settings,
  });
}));

// ---------------------------------------------------------------- uploads
router.post('/uploads', upload.single('file'), ah(async (req, res) => {
  if (!req.file) throw bad('Choose an image to upload.');
  res.json({ url: `/uploads/${req.file.filename}` });
}));

// ---------------------------------------------------------------- feed
router.post('/posts', ah(async (req, res) => {
  const text = str(req.body.text, 2000);
  if (!text) throw bad('Write something first.');
  const id = newId('post');
  await q('INSERT INTO posts(id,author_id,text,image,kind) VALUES ($1,$2,$3,$4,$5)',
    [id, req.user.id, text, str(req.body.image, 300) || null, ['post', 'photo', 'event', 'car'].includes(req.body.kind) ? req.body.kind : 'post']);
  const row = await one(`${POST_SELECT} WHERE p.id=$2`, [req.user.id, id]);
  res.json({ post: postOut(row) });
}));

router.delete('/posts/:id', ah(async (req, res) => {
  const p = await one('SELECT * FROM posts WHERE id=$1', [req.params.id]);
  if (!p) throw notFound();
  if (p.author_id !== req.user.id) throw forbidden('You can only delete your own posts.');
  await q('DELETE FROM posts WHERE id=$1', [p.id]);
  res.json({ ok: true });
}));

router.post('/posts/:id/like', ah(async (req, res) => {
  const p = await one('SELECT * FROM posts WHERE id=$1 AND NOT hidden', [req.params.id]);
  if (!p) throw notFound();
  const del = await q('DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2', [p.id, req.user.id]);
  if (!del.rowCount) {
    await q('INSERT INTO post_likes(post_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [p.id, req.user.id]);
    if (p.author_id !== req.user.id) {
      await notify(p.author_id, `${req.user.first_name} ${req.user.last_name} liked your post`, p.text.slice(0, 90), '/dashboard');
    }
  }
  const row = await one(`${POST_SELECT} WHERE p.id=$2`, [req.user.id, p.id]);
  res.json({ post: postOut(row) });
}));

router.get('/posts/:id/comments', ah(async (req, res) => {
  const rows = await many(
    `SELECT c.*, u.first_name, u.last_name FROM comments c JOIN users u ON u.id=c.author_id
     WHERE c.post_id=$1 AND NOT c.hidden ORDER BY c.created_at`,
    [req.params.id],
  );
  res.json({ comments: rows.map((c) => ({ id: c.id, authorId: c.author_id, authorName: `${c.first_name} ${c.last_name}`.trim(), text: c.text, createdAt: c.created_at })) });
}));

router.post('/posts/:id/comments', ah(async (req, res) => {
  const p = await one('SELECT * FROM posts WHERE id=$1 AND NOT hidden', [req.params.id]);
  if (!p) throw notFound();
  const text = str(req.body.text, 1000);
  if (!text) throw bad('Write a comment first.');
  const id = newId('c');
  await q('INSERT INTO comments(id,post_id,author_id,text) VALUES ($1,$2,$3,$4)', [id, p.id, req.user.id, text]);
  if (p.author_id !== req.user.id) {
    await notify(p.author_id, `${req.user.first_name} commented on your post`, text.slice(0, 90), '/dashboard');
  }
  const row = await one(`${POST_SELECT} WHERE p.id=$2`, [req.user.id, p.id]);
  res.json({ post: postOut(row), comment: { id, authorId: req.user.id, authorName: `${req.user.first_name} ${req.user.last_name}`.trim(), text, createdAt: new Date() } });
}));

router.delete('/comments/:id', ah(async (req, res) => {
  const c = await one('SELECT * FROM comments WHERE id=$1', [req.params.id]);
  if (!c) throw notFound();
  if (c.author_id !== req.user.id) throw forbidden();
  await q('DELETE FROM comments WHERE id=$1', [c.id]);
  res.json({ ok: true });
}));

router.post('/reports', ah(async (req, res) => {
  const type = str(req.body.targetType, 20);
  if (!['post', 'comment', 'listing', 'user', 'car', 'message'].includes(type)) throw bad('Unknown report type.');
  const reason = str(req.body.reason, 500);
  if (!reason) throw bad('Tell us what is wrong.');
  await q('INSERT INTO reports(id,target_type,target_id,reporter_id,reason) VALUES ($1,$2,$3,$4,$5)',
    [newId('rep'), type, str(req.body.targetId, 80), req.user.id, reason]);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- garage
function carData(b, base = {}) {
  const d = { ...base };
  const s = (k, max = 200) => { if (b[k] !== undefined) d[k] = str(b[k], max); };
  s('make', 40); s('model', 120); s('transmission'); s('drivetrain'); s('wheels'); s('suspension'); s('exhaust');
  if (b.year !== undefined) d.year = int(b.year, new Date().getFullYear(), 1950, 2100);
  if (b.mileage !== undefined) d.mileage = int(b.mileage, 0, 0, 5_000_000);
  if (b.engine) d.engine = { code: str(b.engine.code, 40), displacement: str(b.engine.displacement, 40), hp: int(b.engine.hp, 0, 0, 3000), torque: int(b.engine.torque, 0, 0, 5000) };
  if (b.tires) d.tires = { front: str(b.tires.front, 80), rear: str(b.tires.rear, 80) };
  if (b.paint) d.paint = { name: str(b.paint.name, 80), hex: /^#[0-9a-f]{6}$/i.test(b.paint.hex) ? b.paint.hex : '#1C69D4' };
  if (b.purchase) d.purchase = { date: str(b.purchase.date, 20), price: num(b.purchase.price, 0), dealer: str(b.purchase.dealer, 120) };
  if (Array.isArray(b.modifications)) d.modifications = b.modifications.map((m) => str(m, 160)).filter(Boolean).slice(0, 40);
  if (Array.isArray(b.photos)) d.photos = b.photos.map((m) => str(m, 300)).filter(Boolean).slice(0, 12);
  if (Array.isArray(b.semanticTags)) d.semanticTags = b.semanticTags.map((m) => str(m, 40)).filter(Boolean).slice(0, 20);
  return d;
}

const CAR_DEFAULTS = {
  make: 'BMW', model: '', year: new Date().getFullYear(), engine: { code: '', displacement: '', hp: 0, torque: 0 },
  transmission: '', drivetrain: 'RWD', tires: { front: '', rear: '' }, paint: { name: '', hex: '#1C69D4' }, wheels: '',
  suspension: '', exhaust: '', modifications: [], mileage: 0, purchase: { date: '', price: 0, dealer: '' }, photos: [],
  aiInsights: [], semanticTags: [], suggestionSlots: [],
};

router.post('/cars', ah(async (req, res) => {
  const data = carData(req.body, CAR_DEFAULTS);
  if (!data.model) throw bad('Enter the model.');
  if (!data.semanticTags.length) data.semanticTags = [data.model.split(' ').slice(0, 2).join(' ').toLowerCase(), data.drivetrain?.toLowerCase()].filter(Boolean);
  const id = newId('car');
  await q('INSERT INTO cars(id,owner_id,data) VALUES ($1,$2,$3)', [id, req.user.id, data]);
  res.json({ car: carOut(await one('SELECT * FROM cars WHERE id=$1', [id])) });
}));

router.patch('/cars/:id', ah(async (req, res) => {
  const c = await one('SELECT * FROM cars WHERE id=$1', [req.params.id]);
  if (!c) throw notFound();
  if (c.owner_id !== req.user.id) throw forbidden('You can only edit your own cars.');
  const data = carData(req.body, c.data);
  await q('UPDATE cars SET data=$2 WHERE id=$1', [c.id, data]);
  res.json({ car: carOut(await one('SELECT * FROM cars WHERE id=$1', [c.id])) });
}));

router.delete('/cars/:id', ah(async (req, res) => {
  const c = await one('SELECT * FROM cars WHERE id=$1', [req.params.id]);
  if (!c) throw notFound();
  if (c.owner_id !== req.user.id) throw forbidden();
  await q('DELETE FROM cars WHERE id=$1', [c.id]);
  res.json({ ok: true });
}));

router.post('/cars/:id/insights', ah(async (req, res) => {
  const c = await one('SELECT * FROM cars WHERE id=$1', [req.params.id]);
  if (!c) throw notFound();
  if (c.owner_id !== req.user.id) throw forbidden();
  const insights = await carInsights(c.data);
  if (!insights.length) throw bad('The AI did not return any insights. Try again.');
  await q("UPDATE cars SET data = jsonb_set(data,'{aiInsights}',$2::jsonb) WHERE id=$1", [c.id, JSON.stringify(insights)]);
  res.json({ car: carOut(await one('SELECT * FROM cars WHERE id=$1', [c.id])) });
}));

// ---------------------------------------------------------------- events
async function promoteWaitlist(eventId) {
  const [ev] = await eventsOut(null, { includeUnpublished: true, id: eventId });
  if (!ev) return;
  let free = ev.seatsLeft;
  const waiting = await many("SELECT * FROM rsvps WHERE event_id=$1 AND status='waitlist' ORDER BY created_at", [eventId]);
  for (const w of waiting) {
    if (1 + w.guests > free) break;
    await q("UPDATE rsvps SET status='going', updated_at=now() WHERE id=$1", [w.id]);
    await notify(w.user_id, `You're in: ${ev.title}`, 'A place opened up and your waitlist spot is now confirmed.', '/events');
    free -= 1 + w.guests;
  }
}
export { promoteWaitlist };

router.put('/events/:id/rsvp', ah(async (req, res) => {
  const [ev] = await eventsOut(req.user.id, { id: req.params.id });
  if (!ev) throw notFound('Event not found.');
  if (ev.cancelled) throw bad('This event has been cancelled.');
  const es = await getSetting('events');
  const guests = int(req.body.guests, 0, 0, es.maxGuests ?? 4);
  const carsN = int(req.body.cars, 0, 0, es.maxCars ?? 3);
  const party = 1 + guests;
  const existing = await one('SELECT * FROM rsvps WHERE event_id=$1 AND user_id=$2', [ev.id, req.user.id]);
  const mine = existing?.status === 'going' ? 1 + existing.guests : 0;
  const available = ev.seatsLeft + mine;
  let status = 'going';
  if (party > available) {
    if (!es.enableWaitlist) throw bad(`Only ${available} place${available === 1 ? '' : 's'} left.`);
    status = 'waitlist';
  }
  const amount = (ev.packagePrice || 0) * party;
  const paymentStatus = existing?.payment_status === 'paid' && amount <= (existing.amount || 0) ? 'paid' : amount > 0 ? 'unpaid' : 'free';
  const r = await one(
    `INSERT INTO rsvps(id,event_id,user_id,status,guests,cars,amount,payment_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (event_id,user_id) DO UPDATE SET status=EXCLUDED.status, guests=EXCLUDED.guests, cars=EXCLUDED.cars,
       amount=EXCLUDED.amount, payment_status=EXCLUDED.payment_status, updated_at=now()
     RETURNING *`,
    [newId('rsvp'), ev.id, req.user.id, status, guests, carsN, amount, paymentStatus],
  );

  // Payment: one pending order per RSVP, kept in sync with the party size.
  let order = null;
  let url = null;
  if (status === 'going' && paymentStatus === 'unpaid') {
    await q("UPDATE orders SET status='cancelled' WHERE type='event' AND ref_id=$1 AND user_id=$2 AND status='pending'", [ev.id, req.user.id]);
    order = await createOrder(req.user.id, { type: 'event', refId: ev.id, description: `${ev.title} — ${party} ${party === 1 ? 'person' : 'people'}`, amount });
    if (req.body.payNow && (await stripeEnabled())) url = await checkoutUrl(order, req.user, '/events');
  }
  if (status === 'waitlist') {
    await notify(req.user.id, `Waitlisted: ${ev.title}`, 'The event is full. We will confirm your place automatically if one opens.', '/events');
  }
  const [fresh] = await eventsOut(req.user.id, { id: ev.id });
  res.json({ rsvp: rsvpOut(r), event: fresh, order: order && orderOut(order), url });
}));

router.delete('/events/:id/rsvp', ah(async (req, res) => {
  const r = await one("UPDATE rsvps SET status='cancelled', updated_at=now() WHERE event_id=$1 AND user_id=$2 RETURNING *", [req.params.id, req.user.id]);
  if (r) {
    await q("UPDATE orders SET status='cancelled' WHERE type='event' AND ref_id=$1 AND user_id=$2 AND status='pending'", [req.params.id, req.user.id]);
    await promoteWaitlist(req.params.id);
  }
  const [fresh] = await eventsOut(req.user.id, { id: req.params.id });
  res.json({ ok: true, event: fresh });
}));

router.post('/events/:id/pay', ah(async (req, res) => {
  const o = await one("SELECT * FROM orders WHERE type='event' AND ref_id=$1 AND user_id=$2 AND status='pending' ORDER BY created_at DESC LIMIT 1", [req.params.id, req.user.id]);
  if (!o) throw bad('Nothing to pay for this event.');
  if (!(await stripeEnabled())) throw bad('Online payment is not available yet. The club will contact you about payment.');
  res.json({ url: await checkoutUrl(o, req.user, '/events') });
}));

// ---------------------------------------------------------------- marketplace
router.post('/listings', ah(async (req, res) => {
  const ms = await getSetting('marketplace');
  const title = str(req.body.title, 160);
  const price = num(req.body.price, -1);
  if (!title) throw bad('Enter a title.');
  if (!(price >= 0)) throw bad('Enter a valid price.');
  const category = ms.categories.includes(req.body.category) ? req.body.category : ms.categories[0];
  const condition = ms.conditions.includes(req.body.condition) ? req.body.condition : ms.conditions[0];
  const active = await one("SELECT count(*)::int AS n FROM listings WHERE seller_id=$1 AND status IN ('Active','Pending')", [req.user.id]);
  if (active.n >= (ms.maxActivePerMember || 10)) throw bad(`You can have up to ${ms.maxActivePerMember} active listings.`);
  const id = newId('ml');
  const status = ms.requireApproval ? 'Pending' : 'Active';
  await q('INSERT INTO listings(id,title,seller_id,price,condition,category,status,image,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [id, title, req.user.id, price, condition, category, status, str(req.body.image, 300), str(req.body.description, 2000)]);
  res.json({ listing: listingOut(await one('SELECT * FROM listings WHERE id=$1', [id])) });
}));

router.patch('/listings/:id', ah(async (req, res) => {
  const l = await one('SELECT * FROM listings WHERE id=$1', [req.params.id]);
  if (!l) throw notFound();
  if (l.seller_id !== req.user.id) throw forbidden();
  const b = req.body;
  const status = b.status === 'Sold' ? 'Sold' : l.status;
  await q('UPDATE listings SET title=$2, price=$3, description=$4, image=$5, status=$6 WHERE id=$1', [
    l.id, b.title !== undefined ? str(b.title, 160) : l.title, b.price !== undefined ? num(b.price, l.price) : l.price,
    b.description !== undefined ? str(b.description, 2000) : l.description, b.image !== undefined ? str(b.image, 300) : l.image, status,
  ]);
  res.json({ listing: listingOut(await one('SELECT * FROM listings WHERE id=$1', [l.id])) });
}));

router.delete('/listings/:id', ah(async (req, res) => {
  const l = await one('SELECT * FROM listings WHERE id=$1', [req.params.id]);
  if (!l) throw notFound();
  if (l.seller_id !== req.user.id) throw forbidden();
  await q('DELETE FROM listings WHERE id=$1', [l.id]);
  res.json({ ok: true });
}));

router.post('/listings/:id/buy', ah(async (req, res) => {
  const l = await one("SELECT * FROM listings WHERE id=$1 AND status='Active'", [req.params.id]);
  if (!l) throw bad('This item is no longer available.');
  if (l.seller_id === req.user.id) throw bad('This is your own listing.');
  const order = await createOrder(req.user.id, { type: 'listing', refId: l.id, description: l.title, amount: l.price });
  let url = null;
  if (await stripeEnabled()) {
    url = await checkoutUrl(order, req.user, '/parts');
  } else {
    await notify(l.seller_id, 'Purchase request', `${req.user.first_name} ${req.user.last_name} (${req.user.email}) wants to buy "${l.title}".`, '/parts');
  }
  await audit(req, 'listing.purchase_requested', 'listing', l.id, { order: order.id });
  res.json({ order: orderOut(order), url });
}));

// ---------------------------------------------------------------- notifications
router.post('/notifications/read-all', ah(async (req, res) => {
  await q(
    `INSERT INTO notification_reads(notification_id,user_id)
     SELECT id,$1 FROM notifications WHERE user_id=$1 OR user_id IS NULL ON CONFLICT DO NOTHING`,
    [req.user.id],
  );
  res.json({ notifications: await notificationsFor(req.user) });
}));

router.post('/notifications/:id/read', ah(async (req, res) => {
  await q('INSERT INTO notification_reads(notification_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [int(req.params.id), req.user.id]);
  res.json({ notifications: await notificationsFor(req.user) });
}));
