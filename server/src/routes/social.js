/**
 * Private chat (1:1 + event crew chats), blocking, and Car of the Month voting.
 *
 * Privacy model:
 * - A conversation is readable only by its members. There is no admin endpoint that lists or reads chats.
 * - The first message to someone you have never chatted with lands in their "Requests" until they reply or accept.
 * - Either member can block the other; blocked members cannot start or continue a direct chat.
 * - A reported message is the only chat content moderators see (via the normal reports queue).
 */
import { Router } from 'express';
import { one, q, many, newId } from '../db.js';
import { requireAuth } from '../auth.js';
import { ah, bad, notFound, forbidden, str, initials } from '../util.js';

export const router = Router();
router.use(['/chats', '/messages', '/blocks', '/podium'], requireAuth);

const MAX_BODY = 2000;

// ---------------------------------------------------------------- helpers
const iso = (d) => (d ? new Date(d).toISOString() : null);

function messageOut(m, viewerId) {
  const deleted = !!m.deleted_at;
  return {
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    senderName: m.sender_name ?? 'Member',
    body: deleted ? '' : m.body,
    attachment: deleted ? null : m.attachment ?? null,
    createdAt: iso(m.created_at),
    mine: m.sender_id === viewerId,
    deleted,
  };
}

const MSG_SELECT = `SELECT m.*, trim(u.first_name || ' ' || u.last_name) AS sender_name
  FROM messages m LEFT JOIN users u ON u.id = m.sender_id`;

async function isBlockedBetween(a, b) {
  return !!(await one('SELECT 1 FROM user_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)', [a, b]));
}

/** Keep the member's event crew chats in sync with the events they are going to. */
async function ensureCrews(userId) {
  const going = await many(
    `SELECT e.id, e.title FROM rsvps r JOIN events e ON e.id = r.event_id
     WHERE r.user_id=$1 AND r.status='going' AND NOT e.cancelled AND e.end_date >= current_date - 14`,
    [userId],
  );
  for (const e of going) {
    let c = await one('SELECT id FROM conversations WHERE event_id=$1', [e.id]);
    if (!c) {
      c = await one(
        `INSERT INTO conversations(id,kind,event_id,title) VALUES ($1,'crew',$2,$3)
         ON CONFLICT (event_id) DO UPDATE SET title=EXCLUDED.title RETURNING id`,
        [newId('cv'), e.id, `${e.title} crew`],
      );
    }
    await q('INSERT INTO conversation_members(conversation_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [c.id, userId]);
  }
  // No longer going → drop out of that crew.
  await q(
    `UPDATE conversation_members cm SET status='left'
     FROM conversations c
     WHERE c.id=cm.conversation_id AND c.kind='crew' AND cm.user_id=$1 AND cm.status='active'
       AND NOT EXISTS (SELECT 1 FROM rsvps r WHERE r.event_id=c.event_id AND r.user_id=$1 AND r.status='going')`,
    [userId],
  );
}

const LIST_SQL = `
  SELECT c.*, me.status AS my_status, me.last_read_at AS my_read,
    e.title AS event_title, e.image AS event_image, e.start_date AS event_start,
    peer.id AS peer_id, peer.first_name AS peer_first, peer.last_name AS peer_last, peer.location AS peer_location,
    pm.status AS peer_status, pm.last_read_at AS peer_read,
    (SELECT count(*)::int FROM conversation_members x WHERE x.conversation_id=c.id AND x.status<>'left') AS member_count,
    (SELECT count(*)::int FROM messages m WHERE m.conversation_id=c.id AND m.created_at > me.last_read_at
       AND m.sender_id IS DISTINCT FROM me.user_id AND m.deleted_at IS NULL) AS unread,
    (SELECT count(*)::int FROM messages m WHERE m.conversation_id=c.id) AS message_count,
    lm.body AS lm_body, lm.created_at AS lm_at, lm.sender_id AS lm_sender, lm.deleted_at AS lm_deleted,
    lm.attachment->>'type' AS lm_attachment, trim(lu.first_name || ' ' || lu.last_name) AS lm_sender_name,
    EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id=me.user_id AND b.blocked_id=peer.id)
                                         OR (b.blocker_id=peer.id AND b.blocked_id=me.user_id)) AS blocked
  FROM conversation_members me
  JOIN conversations c ON c.id = me.conversation_id
  LEFT JOIN events e ON e.id = c.event_id
  LEFT JOIN conversation_members pm ON c.kind='direct' AND pm.conversation_id=c.id AND pm.user_id<>me.user_id
  LEFT JOIN users peer ON peer.id = pm.user_id
  LEFT JOIN LATERAL (SELECT * FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) lm ON true
  LEFT JOIN users lu ON lu.id = lm.sender_id
  WHERE me.user_id=$1 AND me.status<>'left'`;

function conversationOut(r, viewerId) {
  const direct = r.kind === 'direct';
  const peerName = direct ? `${r.peer_first ?? ''} ${r.peer_last ?? ''}`.trim() || 'Member' : null;
  return {
    id: r.id,
    kind: r.kind,
    title: direct ? peerName : r.event_title ? `${r.event_title}` : r.title,
    subtitle: direct
      ? r.peer_location || ''
      : r.event_start
        ? `Crew chat · ${new Date(r.event_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
        : 'Crew chat',
    image: direct ? null : r.event_image || null,
    eventId: r.event_id,
    peer: direct && r.peer_id ? { id: r.peer_id, name: peerName, initials: initials(r.peer_first, r.peer_last), location: r.peer_location || '' } : null,
    memberCount: r.member_count,
    status: r.my_status === 'request' ? 'request' : 'active',
    awaitingAccept: direct && r.peer_status === 'request',
    peerDeclined: direct && r.peer_status === 'left',
    lastMessage: r.lm_at
      ? {
          body: r.lm_deleted ? 'Message deleted' : r.lm_body,
          senderName: r.lm_sender_name || 'Member',
          mine: r.lm_sender === viewerId,
          createdAt: iso(r.lm_at),
          attachmentType: r.lm_deleted ? null : r.lm_attachment,
        }
      : null,
    lastMessageAt: iso(r.lm_at || r.created_at),
    unread: r.unread,
    blocked: !!r.blocked,
    peerLastReadAt: direct ? iso(r.peer_read) : null,
    _messageCount: r.message_count,
  };
}

async function loadConversation(id, userId) {
  const r = await one(`${LIST_SQL} AND c.id=$2`, [userId, id]);
  if (!r) throw notFound('Conversation not found.');
  return r;
}

const strip = ({ _messageCount, ...c }) => c;

/** Builds a trusted attachment from an id the client sent (never trust titles/images from the client). */
async function buildAttachment(a, userId) {
  if (!a || typeof a !== 'object') return null;
  const type = str(a.type, 20);
  const id = str(a.id, 80);
  if (type === 'car') {
    const c = await one('SELECT * FROM cars WHERE id=$1 AND (NOT hidden OR owner_id=$2)', [id, userId]);
    if (!c) throw bad('That car is not available.');
    const d = c.data || {};
    return { type, id, title: `${d.year ?? ''} ${d.make ?? ''} ${d.model ?? ''}`.trim(), subtitle: d.paint?.name || '', image: d.photos?.[0] || null };
  }
  if (type === 'event') {
    const e = await one('SELECT * FROM events WHERE id=$1 AND published AND NOT cancelled', [id]);
    if (!e) throw bad('That event is not available.');
    return { type, id, title: e.title, subtitle: `${new Date(e.start_date).toISOString().slice(0, 10)} · ${e.location}`, image: e.image || null };
  }
  if (type === 'listing') {
    const l = await one("SELECT * FROM listings WHERE id=$1 AND status='Active'", [id]);
    if (!l) throw bad('That listing is not available.');
    return { type, id, title: l.title, subtitle: `€${Number(l.price).toLocaleString('en-GB')}`, image: l.image || null };
  }
  if (type === 'image') {
    const url = str(a.url, 300);
    if (!/^\/uploads\/[\w.-]+$/.test(url)) throw bad('Upload the photo first.');
    return { type, url };
  }
  throw bad('Unknown attachment.');
}

// ---------------------------------------------------------------- chats
router.get('/chats/unread', ah(async (req, res) => {
  const r = await one(
    `SELECT
       COALESCE(sum(CASE WHEN me.status='active' THEN (SELECT count(*) FROM messages m WHERE m.conversation_id=me.conversation_id
          AND m.created_at > me.last_read_at AND m.sender_id IS DISTINCT FROM me.user_id AND m.deleted_at IS NULL) ELSE 0 END),0)::int AS unread,
       count(*) FILTER (WHERE me.status='request' AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id=me.conversation_id))::int AS requests
     FROM conversation_members me WHERE me.user_id=$1 AND me.status<>'left'`,
    [req.user.id],
  );
  res.json({ unread: r.unread + r.requests, requests: r.requests });
}));

router.get('/chats', ah(async (req, res) => {
  await ensureCrews(req.user.id);
  const rows = await many(`${LIST_SQL} ORDER BY COALESCE(lm.created_at, c.created_at) DESC LIMIT 200`, [req.user.id]);
  const list = rows
    .map((r) => conversationOut(r, req.user.id))
    // a request with no messages yet is invisible to the recipient
    .filter((c) => !(c.status === 'request' && c._messageCount === 0))
    .map(strip);
  res.json({ conversations: list });
}));

router.post('/chats', ah(async (req, res) => {
  const me = req.user;
  const otherId = str(req.body.userId, 80);
  if (!otherId || otherId === me.id) throw bad('Pick a member to message.');
  const other = await one('SELECT * FROM users WHERE id=$1', [otherId]);
  if (!other || other.status === 'Suspended') throw notFound('Member not found.');
  if (await isBlockedBetween(me.id, otherId)) throw forbidden('You cannot message this member.');
  const key = [me.id, otherId].sort().join('|');
  let c = await one('SELECT * FROM conversations WHERE direct_key=$1', [key]);
  if (!c) {
    if (other.privacy?.allowMessages === false) throw forbidden(`${other.first_name} is not accepting new messages.`);
    c = await one(
      `INSERT INTO conversations(id,kind,direct_key,created_by) VALUES ($1,'direct',$2,$3)
       ON CONFLICT (direct_key) DO UPDATE SET direct_key=EXCLUDED.direct_key RETURNING *`,
      [newId('cv'), key, me.id],
    );
    await q("INSERT INTO conversation_members(conversation_id,user_id,status,last_read_at) VALUES ($1,$2,'active',now()) ON CONFLICT DO NOTHING", [c.id, me.id]);
    await q("INSERT INTO conversation_members(conversation_id,user_id,status) VALUES ($1,$2,'request') ON CONFLICT DO NOTHING", [c.id, otherId]);
  } else {
    await q("UPDATE conversation_members SET status='active' WHERE conversation_id=$1 AND user_id=$2 AND status='left'", [c.id, me.id]);
  }
  res.json({ conversation: strip(conversationOut(await loadConversation(c.id, me.id), me.id)) });
}));

router.get('/chats/:id', ah(async (req, res) => {
  const r = await loadConversation(req.params.id, req.user.id);
  const rows = await many(`${MSG_SELECT} WHERE m.conversation_id=$1 ORDER BY m.created_at DESC LIMIT 150`, [r.id]);
  if (r.my_status === 'active') await q('UPDATE conversation_members SET last_read_at=now() WHERE conversation_id=$1 AND user_id=$2', [r.id, req.user.id]);
  res.json({
    conversation: strip(conversationOut({ ...r, unread: 0 }, req.user.id)),
    messages: rows.reverse().map((m) => messageOut(m, req.user.id)),
  });
}));

router.get('/chats/:id/messages', ah(async (req, res) => {
  const r = await loadConversation(req.params.id, req.user.id);
  const after = new Date(String(req.query.after || 0));
  const rows = await many(
    `${MSG_SELECT} WHERE m.conversation_id=$1 AND (m.created_at > $2 OR (m.deleted_at IS NOT NULL AND m.deleted_at > $2))
     ORDER BY m.created_at ASC LIMIT 200`,
    [r.id, Number.isNaN(after.getTime()) ? new Date(0) : after],
  );
  if (r.my_status === 'active' && rows.length) await q('UPDATE conversation_members SET last_read_at=now() WHERE conversation_id=$1 AND user_id=$2', [r.id, req.user.id]);
  res.json({ messages: rows.map((m) => messageOut(m, req.user.id)), peerLastReadAt: r.kind === 'direct' ? iso(r.peer_read) : null });
}));

router.post('/chats/:id/messages', ah(async (req, res) => {
  const me = req.user;
  const r = await loadConversation(req.params.id, me.id);
  if (r.kind === 'direct') {
    if (r.blocked) throw forbidden('You cannot message this member.');
    if (r.peer_status === 'left') throw forbidden('This member is not accepting your messages.');
  }
  const body = str(req.body.body, MAX_BODY);
  const attachment = await buildAttachment(req.body.attachment, me.id);
  if (!body && !attachment) throw bad('Type a message.');
  // Replying to a request accepts it.
  if (r.my_status === 'request') await q("UPDATE conversation_members SET status='active' WHERE conversation_id=$1 AND user_id=$2", [r.id, me.id]);
  const m = await one(
    'INSERT INTO messages(id,conversation_id,sender_id,body,attachment) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [newId('msg'), r.id, me.id, body, attachment],
  );
  await q('UPDATE conversations SET last_message_at=$2 WHERE id=$1', [r.id, m.created_at]);
  await q('UPDATE conversation_members SET last_read_at=$3 WHERE conversation_id=$1 AND user_id=$2', [r.id, me.id, m.created_at]);
  res.json({ message: messageOut({ ...m, sender_name: `${me.first_name} ${me.last_name}`.trim() }, me.id) });
}));

router.post('/chats/:id/accept', ah(async (req, res) => {
  const r = await loadConversation(req.params.id, req.user.id);
  await q("UPDATE conversation_members SET status='active', last_read_at=now() WHERE conversation_id=$1 AND user_id=$2", [r.id, req.user.id]);
  res.json({ conversation: strip(conversationOut(await loadConversation(r.id, req.user.id), req.user.id)) });
}));

router.post('/chats/:id/decline', ah(async (req, res) => {
  const r = await loadConversation(req.params.id, req.user.id);
  await q("UPDATE conversation_members SET status='left' WHERE conversation_id=$1 AND user_id=$2", [r.id, req.user.id]);
  if (req.body?.block && r.peer_id) {
    await q('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, r.peer_id]);
  }
  res.json({ ok: true });
}));

router.post('/chats/:id/leave', ah(async (req, res) => {
  const r = await loadConversation(req.params.id, req.user.id);
  await q("UPDATE conversation_members SET status='left' WHERE conversation_id=$1 AND user_id=$2", [r.id, req.user.id]);
  res.json({ ok: true });
}));

router.delete('/messages/:id', ah(async (req, res) => {
  const m = await one('SELECT * FROM messages WHERE id=$1', [req.params.id]);
  if (!m || m.sender_id !== req.user.id) throw notFound('Message not found.');
  await q("UPDATE messages SET deleted_at=now(), body='', attachment=NULL WHERE id=$1", [m.id]);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- blocks
router.get('/blocks', ah(async (req, res) => {
  const rows = await many(
    'SELECT u.id, u.first_name, u.last_name, u.location FROM user_blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=$1 ORDER BY b.created_at DESC',
    [req.user.id],
  );
  res.json({ blocks: rows.map((u) => ({ id: u.id, name: `${u.first_name} ${u.last_name}`.trim(), initials: initials(u.first_name, u.last_name), location: u.location || '' })) });
}));

router.post('/blocks', ah(async (req, res) => {
  const id = str(req.body.userId, 80);
  if (!id || id === req.user.id) throw bad('Pick a member.');
  if (!(await one('SELECT 1 FROM users WHERE id=$1', [id]))) throw notFound('Member not found.');
  await q('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, id]);
  res.json({ ok: true });
}));

router.delete('/blocks/:id', ah(async (req, res) => {
  await q('DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2', [req.user.id, req.params.id]);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- podium (Car of the Month)
const monthOf = (d = new Date()) => d.toISOString().slice(0, 7);

router.get('/podium', ah(async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month)) ? String(req.query.month) : monthOf();
  const [y, mo] = month.split('-').map(Number);
  const closesAt = new Date(Date.UTC(y, mo, 1)).toISOString();
  const prev = monthOf(new Date(Date.UTC(y, mo - 2, 1)));
  const standings = await many(
    `SELECT v.car_id, count(*)::int AS votes FROM car_votes v JOIN cars c ON c.id=v.car_id
     WHERE v.month=$1 AND NOT c.hidden GROUP BY v.car_id ORDER BY votes DESC, min(v.created_at) ASC LIMIT 25`,
    [month],
  );
  const mine = await one('SELECT car_id FROM car_votes WHERE month=$1 AND user_id=$2', [month, req.user.id]);
  const lastWinner = await one(
    `SELECT v.car_id, count(*)::int AS votes FROM car_votes v JOIN cars c ON c.id=v.car_id
     WHERE v.month=$1 AND NOT c.hidden GROUP BY v.car_id ORDER BY votes DESC, min(v.created_at) ASC LIMIT 1`,
    [prev],
  );
  const totals = await one('SELECT count(*)::int AS n FROM car_votes WHERE month=$1', [month]);
  const clubPick = await one('SELECT id FROM cars WHERE featured AND NOT hidden ORDER BY id LIMIT 1');
  res.json({
    month,
    closesAt,
    totalVotes: totals.n,
    standings: standings.map((s) => ({ carId: s.car_id, votes: s.votes })),
    myVote: mine?.car_id ?? null,
    lastWinner: lastWinner ? { month: prev, carId: lastWinner.car_id, votes: lastWinner.votes } : null,
    clubPickCarId: clubPick?.id ?? null,
  });
}));

router.post('/podium/vote', ah(async (req, res) => {
  const carId = str(req.body.carId, 80);
  const car = await one('SELECT * FROM cars WHERE id=$1 AND NOT hidden', [carId]);
  if (!car) throw notFound('Car not found.');
  if (car.owner_id === req.user.id) throw bad('You cannot vote for your own car.');
  const month = monthOf();
  await q(
    `INSERT INTO car_votes(month,user_id,car_id) VALUES ($1,$2,$3)
     ON CONFLICT (month,user_id) DO UPDATE SET car_id=EXCLUDED.car_id, created_at=now()`,
    [month, req.user.id, carId],
  );
  res.json({ ok: true, myVote: carId });
}));

router.delete('/podium/vote', ah(async (req, res) => {
  await q('DELETE FROM car_votes WHERE month=$1 AND user_id=$2', [monthOf(), req.user.id]);
  res.json({ ok: true, myVote: null });
}));
