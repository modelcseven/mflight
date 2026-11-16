import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { one } from './db.js';

export const COOKIE = 'mflight_session';

export const ROLES = ['super_admin', 'admin', 'chapter_lead', 'moderator', 'member'];
export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  chapter_lead: 'Chapter Lead',
  moderator: 'Moderator',
  member: 'Member',
};

/** Admin areas each role may use. */
export const PERMISSIONS = {
  super_admin: ['overview', 'users', 'events', 'moderation', 'garages', 'marketplace', 'orders', 'announcements', 'audit', 'settings'],
  admin: ['overview', 'users', 'events', 'moderation', 'garages', 'marketplace', 'orders', 'announcements', 'audit', 'settings'],
  chapter_lead: ['overview', 'users', 'events', 'announcements'],
  moderator: ['overview', 'moderation', 'garages', 'marketplace'],
  member: [],
};

export const can = (user, area) => !!user && (PERMISSIONS[user.role] || []).includes(area);
export const isStaff = (user) => !!user && user.role !== 'member';

export function issueSession(res, user, remember = true) {
  const token = jwt.sign({ sub: user.id, tv: user.token_version }, config.jwtSecret, {
    expiresIn: remember ? '30d' : '1d',
  });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    maxAge: (remember ? 30 : 1) * 86400000,
    path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

/** Attaches req.user when a valid session cookie is present. Never rejects. */
export async function loadUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const u = await one('SELECT * FROM users WHERE id=$1', [payload.sub]);
    if (u && u.token_version === payload.tv && u.status !== 'Suspended') req.user = u;
  } catch {
    /* invalid/expired token */
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in.' });
  next();
}

export function requireArea(area) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Please sign in.' });
    if (!can(req.user, area)) return res.status(403).json({ error: 'You do not have access to this area.' });
    next();
  };
}

export function requireSuper(req, res, next) {
  if (req.user?.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only.' });
  next();
}
