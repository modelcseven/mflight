import { many, one } from './db.js';
import { PERMISSIONS, ROLE_LABELS } from './auth.js';
import { initials } from './util.js';

/** Live per-user counts: cars, posts, events attended. */
export async function userCounts(ids = null) {
  const rows = await many(
    `SELECT u.id,
       (SELECT count(*)::int FROM cars c WHERE c.owner_id=u.id AND NOT c.hidden) AS cars,
       (SELECT count(*)::int FROM posts p WHERE p.author_id=u.id AND NOT p.hidden) AS posts,
       (SELECT count(*)::int FROM rsvps r WHERE r.user_id=u.id AND r.status='going') AS events
     FROM users u ${ids ? 'WHERE u.id = ANY($1)' : ''}`,
    ids ? [ids] : [],
  );
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}

function stats(u, c) {
  const base = u.stats_base || {};
  return {
    cars: c?.cars ?? 0,
    posts: Math.max(base.posts || 0, c?.posts ?? 0),
    events: (base.events || 0) + (c?.events ?? 0),
  };
}

export function memberOut(u, counts, viewer) {
  const self = viewer && viewer.id === u.id;
  const priv = u.privacy || {};
  const hidden = !self && priv.publicProfile === false;
  return {
    id: u.id,
    name: `${u.first_name} ${u.last_name}`.trim(),
    firstName: u.first_name,
    lastName: u.last_name,
    membershipNumber: u.membership_number,
    location: hidden ? '' : u.location,
    joinDate: typeof u.join_date === 'string' ? u.join_date : new Date(u.join_date).toISOString().slice(0, 10),
    avatarInitials: initials(u.first_name, u.last_name),
    avatarUrl: u.avatar_url || null,
    verified: u.verified,
    clubPosition: u.club_position || null,
    role: u.role,
    tierId: u.tier_id,
    stats: stats(u, counts?.[u.id]),
  };
}

export async function profileOut(u) {
  const counts = await userCounts([u.id]);
  const tier = u.tier_id ? await one('SELECT * FROM tiers WHERE id=$1', [u.tier_id]) : null;
  return {
    ...memberOut(u, counts, u),
    name: `${u.first_name} ${u.last_name}`.trim(),
    email: u.email,
    phone: u.phone,
    initials: initials(u.first_name, u.last_name),
    tier: tier?.name || 'Member',
    tierColor: tier?.color || null,
    bio: u.bio,
    status: u.status,
    role: u.role,
    roleLabel: ROLE_LABELS[u.role],
    permissions: PERMISSIONS[u.role] || [],
    chapterCountry: u.chapter_country,
    membershipExpires: u.membership_expires,
    emailVerified: u.email_verified,
    preferences: u.prefs,
    privacy: u.privacy,
    totpEnabled: u.totp_enabled,
    hasPassword: !!u.password_hash,
    connections: { google: !!u.google_id, facebook: !!u.facebook_id },
  };
}

export function carOut(row) {
  return { id: row.id, ownerId: row.owner_id, featured: row.featured, hidden: row.hidden, ...row.data };
}

export function postOut(row) {
  return {
    id: row.id,
    authorId: row.author_id,
    text: row.text,
    image: row.image || undefined,
    createdAt: new Date(row.created_at).toISOString(),
    likes: row.base_likes + (row.like_count ?? 0),
    comments: row.base_comments + (row.comment_count ?? 0),
    likedByMe: !!row.liked_by_me,
    pinned: row.pinned,
    hidden: row.hidden,
    isAnnouncement: row.is_announcement,
    kind: row.kind,
  };
}

export const POST_SELECT = `
  SELECT p.*,
    (SELECT count(*)::int FROM post_likes l WHERE l.post_id=p.id) AS like_count,
    (SELECT count(*)::int FROM comments c WHERE c.post_id=p.id AND NOT c.hidden) AS comment_count,
    EXISTS (SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=$1) AS liked_by_me
  FROM posts p`;

/** Events with live going counts. `baseAttendees` excludes the viewer so the client can add its own RSVP. */
export async function eventsOut(viewerId, { includeUnpublished = false, id = null } = {}) {
  const rows = await many(
    `SELECT e.*,
       COALESCE((SELECT sum(1+r.guests)::int FROM rsvps r WHERE r.event_id=e.id AND r.status='going'),0) AS going_all,
       COALESCE((SELECT sum(1+r.guests)::int FROM rsvps r WHERE r.event_id=e.id AND r.status='going' AND r.user_id=$1),0) AS going_me,
       (SELECT count(*)::int FROM rsvps r WHERE r.event_id=e.id AND r.status='waitlist') AS waitlist
     FROM events e
     WHERE ($2 OR e.published) AND ($3::text IS NULL OR e.id=$3)
     ORDER BY e.start_date`,
    [viewerId, includeUnpublished, id],
  );
  return rows.map(eventOut);
}

export function eventOut(e) {
  const going = e.base_attendees + (e.going_all || 0);
  return {
    id: e.id,
    title: e.title,
    location: e.location,
    country: e.country,
    nearestAirport: e.nearest_airport,
    startDate: e.start_date,
    endDate: e.end_date,
    image: e.image,
    category: e.category,
    description: e.description,
    packagePrice: e.package_price,
    perks: e.perks,
    capacity: e.capacity,
    seatsLeft: Math.max(0, e.capacity - going),
    baseAttendees: going - (e.going_me || 0),
    goingTotal: going,
    waitlist: e.waitlist || 0,
    featured: e.featured,
    cancelled: e.cancelled,
    published: e.published,
  };
}

export function rsvpOut(r) {
  return {
    going: r.status === 'going',
    status: r.status,
    guests: r.guests,
    cars: r.cars,
    paymentStatus: r.payment_status,
    amount: r.amount,
    checkedIn: r.checked_in,
  };
}

export function listingOut(l) {
  return {
    id: l.id,
    title: l.title,
    sellerId: l.seller_id,
    price: l.price,
    condition: l.condition,
    category: l.category,
    status: l.status,
    image: l.image,
    description: l.description,
    buyerId: l.buyer_id,
    listedAt: new Date(l.listed_at).toISOString(),
  };
}

export function orderOut(o) {
  return {
    id: o.id,
    userId: o.user_id,
    type: o.type,
    refId: o.ref_id,
    description: o.description,
    amount: o.amount,
    currency: o.currency,
    status: o.status,
    provider: o.provider,
    createdAt: new Date(o.created_at).toISOString(),
    paidAt: o.paid_at ? new Date(o.paid_at).toISOString() : null,
    userName: o.user_name,
    userEmail: o.user_email,
  };
}

export function timeAgoShort(d) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.max(1, Math.round(diff / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}
