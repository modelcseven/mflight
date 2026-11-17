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
    mine: m.sender_id === viewerId && m.kind !== 'system',
    deleted,
    kind: m.kind || 'text',
    replyTo: m.reply_to
      ? {
          id: m.reply_to,
          senderName: m.rm_sender_name || 'Member',
          body: m.rm_deleted ? 'Message deleted' : (m.rm_body || (m.rm_attachment ? `Shared a ${m.rm_attachment}` : '')).slice(0, 140),
        }
      : null,
  };
}

const MSG_SELECT = `SELECT m.*, trim(u.first_name || ' ' || u.last_name) AS sender_name,
    rm.body AS rm_body, rm.deleted_at AS rm_deleted, rm.attachment->>'type' AS rm_attachment,
    trim(ru.first_name || ' ' || ru.last_name) AS rm_sender_name
  FROM messages m
  LEFT JOIN users u ON u.id = m.sender_id
  LEFT JOIN messages rm ON rm.id = m.reply_to
  LEFT JOIN users ru ON ru.id = rm.sender_id`;

/** Posts a grey system line into a chat ("Alex added Sophie"). */
async function systemMessage(conversationId, actorId, body) {
  const m = await one(
    "INSERT INTO messages(id,conversation_id,sender_id,body,kind) VALUES ($1,$2,$3,$4,'system') RETURNING created_at",
    [newId('msg'), conversationId, actorId, body],
  );
  await q('UPDATE conversations SET last_message_at=$2 WHERE id=$1', [conversationId, m.created_at]);
}

const fullName = (u) => `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Member';

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
  SELECT c.*, me.status AS my_status, me.last_read_at AS my_read, me.role AS my_role, me.muted AS my_muted, me.joined_at AS my_joined,
    e.title AS event_title, e.image AS event_image, e.start_date AS event_start,
    peer.id AS peer_id, peer.first_name AS peer_first, peer.last_name AS peer_last, peer.location AS peer_location,
    pm.status AS peer_status, pm.last_read_at AS peer_read,
    (SELECT count(*)::int FROM conversation_members x WHERE x.conversation_id=c.id AND x.status<>'left') AS member_count,
    (SELECT count(*)::int FROM messages m WHERE m.conversation_id=c.id AND m.created_at > me.last_read_at
       AND m.sender_id IS DISTINCT FROM me.user_id AND m.deleted_at IS NULL AND m.kind='text') AS unread,
    (SELECT count(*)::int FROM messages m WHERE m.conversation_id=c.id) AS message_count,
    lm.body AS lm_body, lm.created_at AS lm_at, lm.sender_id AS lm_sender, lm.deleted_at AS lm_deleted,
    lm.attachment->>'type' AS lm_attachment, lm.kind AS lm_kind, trim(lu.first_name || ' ' || lu.last_name) AS lm_sender_name,
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
  const group = r.kind === 'group';
  return {
    id: r.id,
    kind: r.kind,
    title: direct ? peerName : group ? r.title : r.event_title ? `${r.event_title}` : r.title,
    description: group ? r.description || '' : '',
    myRole: r.my_role || 'member',
    muted: !!r.my_muted,
    subtitle: direct
      ? r.peer_location || ''
      : group
        ? `${r.member_count} members`
        : r.event_start
        ? `Crew chat · ${new Date(r.event_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
        : 'Crew chat',
    image: direct ? null : group ? r.image || null : r.event_image || null,
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
          mine: r.lm_sender === viewerId && r.lm_kind !== 'system',
          system: r.lm_kind === 'system',
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
       COALESCE(sum(CASE WHEN me.status='active' AND NOT me.muted THEN (SELECT count(*) FROM messages m WHERE m.conversation_id=me.conversation_id
          AND m.created_at > me.last_read_at AND m.sender_id IS DISTINCT FROM me.user_id AND m.deleted_at IS NULL AND m.kind='text') ELSE 0 END),0)::int AS unread,
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
  // In groups you only see messages from after you joined (like WhatsApp).
  const since = r.kind === 'group' ? r.my_joined : new Date(0);
  const rows = await many(`${MSG_SELECT} WHERE m.conversation_id=$1 AND m.created_at >= $2 ORDER BY m.created_at DESC LIMIT 150`, [r.id, since]);
  if (r.my_status === 'active') await q('UPDATE conversation_members SET last_read_at=now() WHERE conversation_id=$1 AND user_id=$2', [r.id, req.user.id]);
  res.json({
    conversation: strip(conversationOut({ ...r, unread: 0 }, req.user.id)),
    messages: rows.reverse().map((m) => messageOut(m, req.user.id)),
    reads: r.kind === 'direct' ? null : await memberReads(r.id, req.user.id),
  });
}));

router.get('/chats/:id/messages', ah(async (req, res) => {
  const r = await loadConversation(req.params.id, req.user.id);
  const after = new Date(String(req.query.after || 0));
  const rows = await many(
    `${MSG_SELECT} WHERE m.conversation_id=$1 AND (m.created_at > $2 OR (m.deleted_at IS NOT NULL AND m.deleted_at > $2))
       AND m.created_at >= $3
     ORDER BY m.created_at ASC LIMIT 200`,
    [r.id, Number.isNaN(after.getTime()) ? new Date(0) : after, r.kind === 'group' ? r.my_joined : new Date(0)],
  );
  if (r.my_status === 'active' && rows.length) await q('UPDATE conversation_members SET last_read_at=now() WHERE conversation_id=$1 AND user_id=$2', [r.id, req.user.id]);
  res.json({
    messages: rows.map((m) => messageOut(m, req.user.id)),
    peerLastReadAt: r.kind === 'direct' ? iso(r.peer_read) : null,
    reads: r.kind === 'direct' ? null : await memberReads(r.id, req.user.id),
  });
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
  let replyTo = null;
  if (req.body.replyTo) {
    const rm = await one('SELECT id FROM messages WHERE id=$1 AND conversation_id=$2', [str(req.body.replyTo, 80), r.id]);
    if (rm) replyTo = rm.id;
  }
  const ins = await one(
    'INSERT INTO messages(id,conversation_id,sender_id,body,attachment,reply_to) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at',
    [newId('msg'), r.id, me.id, body, attachment, replyTo],
  );
  await q('UPDATE conversations SET last_message_at=$2 WHERE id=$1', [r.id, ins.created_at]);
  await q('UPDATE conversation_members SET last_read_at=$3 WHERE conversation_id=$1 AND user_id=$2', [r.id, me.id, ins.created_at]);
  const m = await one(`${MSG_SELECT} WHERE m.id=$1`, [ins.id]);
  res.json({ message: messageOut(m, me.id) });
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
  await q("UPDATE conversation_members SET status='left', role='member' WHERE conversation_id=$1 AND user_id=$2", [r.id, req.user.id]);
  if (r.kind === 'group') {
    await systemMessage(r.id, req.user.id, `${fullName(req.user)} left`);
    await ensureGroupAdmin(r.id);
  }
  res.json({ ok: true });
}));

router.post('/chats/:id/mute', ah(async (req, res) => {
  const r = await loadConversation(req.params.id, req.user.id);
  await q('UPDATE conversation_members SET muted=$3 WHERE conversation_id=$1 AND user_id=$2', [r.id, req.user.id, !!req.body?.muted]);
  res.json({ ok: true, muted: !!req.body?.muted });
}));

// ---------------------------------------------------------------- groups
async function memberReads(conversationId, viewerId) {
  const rows = await many(
    "SELECT user_id, last_read_at FROM conversation_members WHERE conversation_id=$1 AND status='active' AND user_id<>$2",
    [conversationId, viewerId],
  );
  return rows.map((x) => ({ userId: x.user_id, lastReadAt: iso(x.last_read_at) }));
}

/** A group must always have at least one admin: promote the longest-standing member if needed. */
async function ensureGroupAdmin(conversationId) {
  const admin = await one("SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND status='active' AND role='admin'", [conversationId]);
  if (admin) return;
  await q(
    `UPDATE conversation_members SET role='admin' WHERE conversation_id=$1 AND user_id=(
       SELECT user_id FROM conversation_members WHERE conversation_id=$1 AND status='active' ORDER BY joined_at ASC LIMIT 1)`,
    [conversationId],
  );
}

async function loadGroup(id, user, { admin = false } = {}) {
  const r = await loadConversation(id, user.id);
  if (r.kind !== 'group') throw bad('This is not a group chat.');
  if (r.my_status !== 'active') throw forbidden('You are not in this group.');
  if (admin && r.my_role !== 'admin') throw forbidden('Only group admins can do that.');
  return r;
}

const validImage = (v) => {
  if (v === null || v === '') return null;
  const s = str(v, 300);
  if (!/^\/uploads\/[\w.-]+$/.test(s)) throw bad('Upload the group photo first.');
  return s;
};

/** Members that may be added by `actor`: active accounts that haven't blocked them and accept messages. */
async function addableUsers(actorId, ids) {
  const clean = [...new Set((Array.isArray(ids) ? ids : []).map((x) => str(x, 80)).filter((x) => x && x !== actorId))].slice(0, 255);
  if (!clean.length) return { ok: [], skipped: [] };
  const rows = await many("SELECT * FROM users WHERE id = ANY($1) AND status <> 'Suspended'", [clean]);
  const ok = [];
  const skipped = [];
  for (const u of rows) {
    if ((await isBlockedBetween(actorId, u.id)) || u.privacy?.allowMessages === false) skipped.push(fullName(u));
    else ok.push(u);
  }
  return { ok, skipped };
}

router.post('/chats/groups', ah(async (req, res) => {
  const me = req.user;
  const title = str(req.body.title, 80);
  if (!title) throw bad('Give the group a name.');
  const description = str(req.body.description, 500);
  const image = req.body.image ? validImage(req.body.image) : null;
  const { ok, skipped } = await addableUsers(me.id, req.body.memberIds);
  if (!ok.length) throw bad('Add at least one member who can join.');
  const c = await one(
    "INSERT INTO conversations(id,kind,title,description,image,created_by) VALUES ($1,'group',$2,$3,$4,$5) RETURNING *",
    [newId('cv'), title, description, image, me.id],
  );
  await q("INSERT INTO conversation_members(conversation_id,user_id,role,last_read_at) VALUES ($1,$2,'admin',now())", [c.id, me.id]);
  for (const u of ok) await q('INSERT INTO conversation_members(conversation_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [c.id, u.id]);
  await systemMessage(c.id, me.id, `${fullName(me)} created the group “${title}”`);
  res.json({ conversation: strip(conversationOut(await loadConversation(c.id, me.id), me.id)), skipped });
}));

router.patch('/chats/:id', ah(async (req, res) => {
  const me = req.user;
  const r = await loadGroup(req.params.id, me, { admin: true });
  const notes = [];
  if (req.body.title !== undefined) {
    const t = str(req.body.title, 80);
    if (!t) throw bad('The group needs a name.');
    if (t !== r.title) {
      await q('UPDATE conversations SET title=$2 WHERE id=$1', [r.id, t]);
      notes.push(`changed the group name to “${t}”`);
    }
  }
  if (req.body.description !== undefined) {
    const d = str(req.body.description, 500);
    if (d !== (r.description || '')) {
      await q('UPDATE conversations SET description=$2 WHERE id=$1', [r.id, d]);
      notes.push('changed the group description');
    }
  }
  if (req.body.image !== undefined) {
    const img = validImage(req.body.image);
    if (img !== (r.image || null)) {
      await q('UPDATE conversations SET image=$2 WHERE id=$1', [r.id, img]);
      notes.push(img ? 'changed the group photo' : 'removed the group photo');
    }
  }
  for (const n of notes) await systemMessage(r.id, me.id, `${fullName(me)} ${n}`);
  res.json({ conversation: strip(conversationOut(await loadConversation(r.id, me.id), me.id)) });
}));

router.delete('/chats/:id', ah(async (req, res) => {
  const r = await loadGroup(req.params.id, req.user, { admin: true });
  await q('DELETE FROM conversations WHERE id=$1', [r.id]);
  res.json({ ok: true });
}));

router.get('/chats/:id/members', ah(async (req, res) => {
  const r = await loadConversation(req.params.id, req.user.id);
  const rows = await many(
    `SELECT u.id, u.first_name, u.last_name, u.location, u.club_position, cm.role, cm.joined_at, cm.last_read_at
     FROM conversation_members cm JOIN users u ON u.id=cm.user_id
     WHERE cm.conversation_id=$1 AND cm.status='active'
     ORDER BY (cm.role='admin') DESC, u.first_name, u.last_name`,
    [r.id],
  );
  res.json({
    members: rows.map((u) => ({
      id: u.id,
      name: fullName(u),
      initials: initials(u.first_name, u.last_name),
      location: u.location || '',
      clubPosition: u.club_position || null,
      role: u.role,
      isMe: u.id === req.user.id,
    })),
  });
}));

router.post('/chats/:id/members', ah(async (req, res) => {
  const me = req.user;
  const r = await loadGroup(req.params.id, me, { admin: true });
  const { ok, skipped } = await addableUsers(me.id, req.body.userIds);
  const added = [];
  for (const u of ok) {
    const cur = await one('SELECT status FROM conversation_members WHERE conversation_id=$1 AND user_id=$2', [r.id, u.id]);
    if (cur?.status === 'active') continue;
    await q(
      `INSERT INTO conversation_members(conversation_id,user_id,status,role,joined_at,last_read_at) VALUES ($1,$2,'active','member',now(),now())
       ON CONFLICT (conversation_id,user_id) DO UPDATE SET status='active', role='member', joined_at=now(), last_read_at=now()`,
      [r.id, u.id],
    );
    added.push(fullName(u));
  }
  if (added.length) await systemMessage(r.id, me.id, `${fullName(me)} added ${added.join(', ')}`);
  res.json({ ok: true, added, skipped });
}));

router.patch('/chats/:id/members/:userId', ah(async (req, res) => {
  const me = req.user;
  const r = await loadGroup(req.params.id, me, { admin: true });
  const role = req.body.role === 'admin' ? 'admin' : 'member';
  const t = await one(
    "SELECT u.*, cm.role AS cm_role FROM conversation_members cm JOIN users u ON u.id=cm.user_id WHERE cm.conversation_id=$1 AND cm.user_id=$2 AND cm.status='active'",
    [r.id, req.params.userId],
  );
  if (!t) throw notFound('Member not found.');
  if (t.cm_role !== role) {
    await q('UPDATE conversation_members SET role=$3 WHERE conversation_id=$1 AND user_id=$2', [r.id, t.id, role]);
    await systemMessage(r.id, me.id, role === 'admin' ? `${fullName(me)} made ${fullName(t)} a group admin` : `${fullName(t)} is no longer a group admin`);
    await ensureGroupAdmin(r.id);
  }
  res.json({ ok: true });
}));

router.delete('/chats/:id/members/:userId', ah(async (req, res) => {
  const me = req.user;
  const r = await loadGroup(req.params.id, me, { admin: true });
  if (req.params.userId === me.id) throw bad('Use “Leave group” to leave.');
  const t = await one(
    "SELECT u.* FROM conversation_members cm JOIN users u ON u.id=cm.user_id WHERE cm.conversation_id=$1 AND cm.user_id=$2 AND cm.status='active'",
    [r.id, req.params.userId],
  );
  if (!t) throw notFound('Member not found.');
  await q("UPDATE conversation_members SET status='left', role='member' WHERE conversation_id=$1 AND user_id=$2", [r.id, t.id]);
  await systemMessage(r.id, me.id, `${fullName(me)} removed ${fullName(t)}`);
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
