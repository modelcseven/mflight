import crypto from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const bad = (msg) => new HttpError(400, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const forbidden = (msg = 'Not allowed') => new HttpError(403, msg);

/** Wraps an async route handler so thrown errors reach the error middleware. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = () => crypto.randomBytes(32).toString('base64url');

export function str(v, max = 2000) {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
}
export function int(v, def = 0, min = -Infinity, max = Infinity) {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}
export function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
export const bool = (v) => v === true || v === 'true' || v === 1 || v === '1';

export function initials(first, last) {
  return `${(first || '?')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();
}

export function csv(rows, columns) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(c.get(r))).join(','))].join('\n');
}
