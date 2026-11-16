import type { ClubEvent } from '@/lib/data';

/** Deterministic 32-bit hash for stable per-event mock content. */
export function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const FIRST = ['Jonas', 'Marta', 'Felix', 'Sofia', 'Pieter', 'Anna', 'Luca', 'Emma', 'Nils', 'Clara', 'Oscar', 'Lena'];
const LAST = ['K.', 'L.', 'R.', 'H.', 'V.', 'W.', 'B.', 'S.', 'T.', 'M.', 'D.', 'F.'];

export interface EventMembers {
  /** Full names of the first few attendees (for avatar initials + names line). */
  names: string[];
  /** Total members attending. */
  total: number;
}

/** Stable mock "members going" list per event. */
export function membersFor(event: ClubEvent): EventMembers {
  const h = hashCode(event.id);
  const names = Array.from({ length: 4 }, (_, i) => `${FIRST[(h + i * 3) % FIRST.length]} ${LAST[(h + i * 5) % LAST.length]}`);
  return { names, total: 9 + (h % 22) };
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .replace('.', '')
    .slice(0, 2)
    .toUpperCase();
}

/** "12 SEP" badge label from the event start date. */
export function dateBadge(event: ClubEvent): string {
  const d = new Date(event.startDate + 'T12:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
  return `${day} ${mon}`;
}

/** "12–14 Sep" / "24–26 May" / "18 Jul" compact range. */
export function dateRange(event: ClubEvent): string {
  const s = new Date(event.startDate + 'T12:00:00');
  const e = new Date(event.endDate + 'T12:00:00');
  const sMon = s.toLocaleDateString('en-GB', { month: 'short' });
  const eMon = e.toLocaleDateString('en-GB', { month: 'short' });
  if (event.startDate === event.endDate) return `${s.getDate()} ${sMon}`;
  if (sMon === eMon) return `${s.getDate()}–${e.getDate()} ${sMon}`;
  return `${s.getDate()} ${sMon} – ${e.getDate()} ${eMon}`;
}

export interface OutboundOption {
  iso: string;
  label: string;
  price: number;
}

/** 2–3 suggested outbound dates around the event start, with deterministic prices. */
export function outboundOptions(event: ClubEvent): OutboundOption[] {
  const start = new Date(event.startDate + 'T12:00:00');
  const h = hashCode(event.id);
  const offsets = [-2, -1, 0];
  const deltas = [-(18 + (h % 20)), 0, 26 + (h % 30)];
  return offsets.map((off, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + off);
    return {
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(),
      price: Math.max(49, event.packagePrice + deltas[i]),
    };
  });
}

/** Mock member saving vs booking separately (~5%). */
export function packageSaving(event: ClubEvent): number {
  return Math.round(event.packagePrice * 0.05);
}

/** "M Festival" style short name from the full data title. */
export function shortTitle(title: string): string {
  return title.replace(/^BMW\s/, '').replace(/\s\d{4}$/, '');
}
