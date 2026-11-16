/**
 * Live data store. Fills the arrays exported from ./data from /api/bootstrap and
 * notifies subscribers on every change, so components re-render with useStore().
 */
import { useSyncExternalStore } from 'react';
import { api } from './api';
import {
  CARS, CLUB_EVENTS, MARKETPLACE_LISTINGS, MEMBERS, MEMBER_CITIES, MEMBER_GEO, MEMBER_PROFILE, NOTIFICATIONS, POSTS,
  SETTINGS, TIERS,
} from './data';
import type {
  AppNotification, Car, ClubEvent, ClubMember, FeedPost, MarketplaceListing, MemberCity, MemberGeo, MemberProfile,
  PublicSettings, Tier,
} from './data';
import { hydrateRsvps } from './rsvp';
import type { Rsvp } from './rsvp';

export interface Bootstrap {
  profile: MemberProfile;
  members: ClubMember[];
  cars: Car[];
  posts: FeedPost[];
  events: ClubEvent[];
  rsvps: Record<string, Rsvp>;
  listings: MarketplaceListing[];
  notifications: AppNotification[];
  geo: MemberGeo[];
  cities: MemberCity[];
  tiers: Tier[];
  settings: PublicSettings;
}

let version = 0;
const listeners = new Set<() => void>();

export function bump() {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Returns a number that changes whenever store data changes (use as a memo dependency). */
export function useStore(): number {
  return useSyncExternalStore(subscribe, () => version);
}

const replace = <T,>(target: T[], next: T[]) => {
  target.splice(0, target.length, ...next);
};

export function hydrate(b: Bootstrap) {
  Object.assign(MEMBER_PROFILE, b.profile);
  replace(MEMBERS, b.members);
  replace(CARS, b.cars);
  replace(POSTS, b.posts);
  replace(CLUB_EVENTS, b.events);
  replace(MARKETPLACE_LISTINGS, b.listings);
  replace(NOTIFICATIONS, b.notifications);
  replace(MEMBER_GEO, b.geo);
  replace(MEMBER_CITIES, b.cities);
  replace(TIERS, b.tiers);
  Object.assign(SETTINGS, b.settings);
  applyBranding(b.settings);
  hydrateRsvps(b.rsvps);
  bump();
}

export async function refresh() {
  const b = await api.get<Bootstrap>('/bootstrap');
  hydrate(b);
  return b;
}

const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (c: [number, number, number], t: number, to: number) => c.map((v) => Math.round(v + (to - v) * t)).join(' ');

/** Applies club branding (title, primary/accent colours, favicon) from settings. */
export function applyBranding(s: PublicSettings | undefined) {
  if (!s?.club) return;
  document.title = `${s.club.name} — ${s.club.clubName}`;
  const root = document.documentElement.style;
  const brand = hexToRgb(s.club.primaryColor || '');
  if (brand) {
    root.setProperty('--brand', brand.join(' '));
    root.setProperty('--brand-dark', mix(brand, 0.17, 0));
    root.setProperty('--brand-light', mix(brand, 0.9, 255));
  }
  const gold = hexToRgb(s.club.accentColor || '');
  if (gold) root.setProperty('--gold', gold.join(' '));
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (icon && s.club.logoUrl) icon.href = s.club.logoUrl;
}

export const logoUrl = () => SETTINGS.club?.logoUrl || `${import.meta.env.BASE_URL}club-emblem.svg`;

/** Helpers that patch a single item in place and notify. */
export function upsert<T extends { id: string }>(list: T[], item: T, atStart = false) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item;
  else if (atStart) list.unshift(item);
  else list.push(item);
  bump();
}

export function removeById<T extends { id: string }>(list: T[], id: string) {
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) list.splice(i, 1);
  bump();
}

export function setProfile(p: MemberProfile) {
  Object.assign(MEMBER_PROFILE, p);
  const m = MEMBERS.find((x) => x.id === p.id);
  if (m) Object.assign(m, { name: p.name, firstName: p.firstName, lastName: p.lastName, location: p.location, avatarInitials: p.initials });
  bump();
}
