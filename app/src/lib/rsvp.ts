/**
 * Shared RSVP store — keeps the feed event rail and the Events page in sync.
 * Backed by the API: hydrated from /api/bootstrap, mutations PUT/DELETE /api/events/:id/rsvp.
 */
import { useSyncExternalStore } from 'react';
import { CLUB_EVENTS, SETTINGS } from './data';
import type { ClubEvent } from './data';
import { api } from './api';
import { bump } from './store';

export interface Rsvp {
  going: boolean;
  /** Extra people the member brings along. */
  guests: number;
  /** Cars the member brings. */
  cars: number;
  status?: 'going' | 'waitlist' | 'cancelled';
  paymentStatus?: 'unpaid' | 'paid' | 'refunded' | 'free';
  amount?: number;
}

export type RsvpMap = Record<string, Rsvp>;

export const MAX_GUESTS = 4;
export const MAX_CARS = 3;
export const maxGuests = () => SETTINGS.events?.maxGuests ?? MAX_GUESTS;
export const maxCars = () => SETTINGS.events?.maxCars ?? MAX_CARS;

let cache: RsvpMap = {};
const listeners = new Set<() => void>();

function emit(next: RsvpMap) {
  cache = next;
  listeners.forEach((l) => l());
}

export function hydrateRsvps(map: RsvpMap) {
  emit({ ...map });
}

export function getRsvps(): RsvpMap {
  return cache;
}

export function getRsvp(eventId: string): Rsvp | undefined {
  return cache[eventId];
}

function patchEvent(ev?: ClubEvent) {
  if (!ev) return;
  const i = CLUB_EVENTS.findIndex((e) => e.id === ev.id);
  if (i >= 0) CLUB_EVENTS[i] = ev;
  bump();
}

export interface RsvpResult {
  rsvp: Rsvp;
  url: string | null;
  order: { id: string; amount: number } | null;
}

/** Saves an RSVP. Resolves with the stored RSVP (may be waitlisted) and an optional payment URL. */
export async function setRsvp(eventId: string, rsvp: Rsvp, opts: { payNow?: boolean } = {}): Promise<RsvpResult> {
  const r = await api.put<{ rsvp: Rsvp; event: ClubEvent; url: string | null; order: RsvpResult['order'] }>(
    `/events/${encodeURIComponent(eventId)}/rsvp`,
    { guests: rsvp.guests, cars: rsvp.cars, payNow: !!opts.payNow },
  );
  emit({ ...cache, [eventId]: r.rsvp });
  patchEvent(r.event);
  return { rsvp: r.rsvp, url: r.url, order: r.order };
}

export async function clearRsvp(eventId: string) {
  const r = await api.del<{ event: ClubEvent }>(`/events/${encodeURIComponent(eventId)}/rsvp`);
  const next = { ...cache };
  delete next[eventId];
  emit(next);
  patchEvent(r.event);
}

export async function payForEvent(eventId: string) {
  const r = await api.post<{ url: string }>(`/events/${encodeURIComponent(eventId)}/pay`);
  window.location.href = r.url;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useRsvps(): RsvpMap {
  return useSyncExternalStore(subscribe, getRsvps);
}

/** Members already attending, excluding the signed-in member (server-computed). */
export function baseAttendees(eventId: string): number {
  return CLUB_EVENTS.find((e) => e.id === eventId)?.baseAttendees ?? 0;
}

/** Live "people going" count: other members + the signed-in member's party when going. */
export function goingCount(eventId: string, rsvps: RsvpMap): number {
  const r = rsvps[eventId];
  return baseAttendees(eventId) + (r?.going ? 1 + r.guests : 0);
}
