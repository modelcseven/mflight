/**
 * MFlight data store — BMW Car Club Europe members-only social platform.
 * Arrays below are filled from the API (/api/bootstrap) by hydrate() in lib/store.ts;
 * pages read them directly and subscribe to changes with useStore().
 *
 * Data is AI-ready: Car carries semantic tags, suggestion slots and optional
 * AI insight hooks so future image-analysis / recommendation features can be
 * layered on without schema changes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClubMember {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  membershipNumber: string; // MFC-XXXX
  location: string;
  joinDate: string; // ISO
  avatarInitials: string;
  verified: boolean;
  stats: {
    cars: number;
    events: number;
    posts: number;
  };
  avatarUrl?: string | null;
  role?: Role;
  tierId?: string | null;
}

export type Role = 'super_admin' | 'admin' | 'chapter_lead' | 'moderator' | 'member';
export type AdminArea =
  | 'overview' | 'users' | 'events' | 'moderation' | 'garages' | 'marketplace' | 'orders' | 'announcements' | 'audit' | 'settings';

export interface CarEngine {
  code: string;
  displacement: string; // e.g. "3.0 L"
  hp: number;
  torque: number; // Nm
}

export interface Car {
  id: string;
  ownerId: string; // ClubMember.id
  make: string; // "BMW"
  model: string;
  year: number;
  engine: CarEngine;
  transmission: string;
  drivetrain: string;
  tires: { front: string; rear: string };
  paint: { name: string; hex: string };
  wheels: string;
  suspension: string;
  exhaust: string;
  modifications: string[];
  mileage: number; // km
  purchase: { date: string; price: number; dealer: string };
  photos: string[]; // multi-angle gallery
  // --- AI-ready fields ---
  aiInsights?: string[];
  semanticTags: string[];
  suggestionSlots: string[];
  featured?: boolean;
  hidden?: boolean;
}

export interface FeedPost {
  id: string;
  authorId: string; // ClubMember.id
  text: string;
  image?: string;
  createdAt: string; // ISO
  likes: number;
  comments: number;
  likedByMe?: boolean;
  pinned?: boolean;
  isAnnouncement?: boolean;
  hidden?: boolean;
}

export interface ClubEvent {
  id: string;
  title: string;
  location: string;
  nearestAirport: string; // IATA
  startDate: string; // ISO
  endDate: string; // ISO
  image: string;
  category: string;
  description: string;
  packagePrice: number; // EUR per person, travel package
  perks: string[];
  seatsLeft: number;
  /** Deterministic members already attending (before the signed-in member's RSVP). */
  baseAttendees: number;
  country?: string | null;
  capacity?: number;
  goingTotal?: number;
  waitlist?: number;
  featured?: boolean;
  cancelled?: boolean;
  published?: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  link?: string | null;
}

export interface MemberProfile {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  initials: string;
  tier: string;
  membershipNumber: string; // MFC-XXXX
  bio: string;
  location: string;
  joinDate: string; // ISO
  verified: boolean;
  stats: {
    cars: number;
    events: number;
    posts: number;
  };
  preferences: {
    newsletter: boolean;
    eventReminders: boolean;
    garageUpdates: boolean;
    marketplace: boolean;
    emailNotifications: boolean;
  };
  privacy: { publicProfile: boolean; publicGarage: boolean; allowMessages?: boolean };
  role: Role;
  roleLabel: string;
  permissions: AdminArea[];
  status: 'Active' | 'Pending' | 'Suspended';
  totpEnabled: boolean;
  hasPassword: boolean;
  connections: { google: boolean; facebook: boolean };
  emailVerified: boolean;
  membershipExpires: string | null;
  chapterCountry: string | null;
  tierId: string | null;
  tierColor?: string | null;
  avatarUrl?: string | null;
}

export interface Tier {
  id: string;
  name: string;
  priceYearly: number;
  benefits: string[];
  color: string;
  isDefault: boolean;
}

export interface PublicSettings {
  club: {
    name: string; clubName: string; tagline: string; logoUrl: string; primaryColor: string; accentColor: string;
    contactEmail: string; currency: string; timezone: string; supportUrl: string;
  };
  events: { categories: string[]; defaultCapacity: number; maxGuests: number; maxCars: number; enableWaitlist: boolean };
  marketplace: { requireApproval: boolean; feePercent: number; categories: string[]; conditions: string[]; maxActivePerMember: number };
  membership: { numberPrefix: string };
  auth: { allowSignup: boolean; google: boolean; facebook: boolean };
  payments: { stripe: boolean };
  ai: { enabled: boolean };
}

export interface Order {
  id: string;
  userId: string | null;
  type: 'event' | 'membership' | 'listing';
  refId: string | null;
  description: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'refunded' | 'cancelled';
  provider: string;
  createdAt: string;
  paidAt: string | null;
  userName?: string;
  userEmail?: string;
}

// ---------------------------------------------------------------------------
// Club members (6)
// ---------------------------------------------------------------------------

export const MEMBERS: ClubMember[] = [];

export function memberById(id: string): ClubMember | undefined {
  return MEMBERS.find((m) => m.id === id);
}

// ---------------------------------------------------------------------------
// Virtual garage (4 cars — the logged-in member owns the first two)
// ---------------------------------------------------------------------------

export const CARS: Car[] = [];

export function carsByOwner(ownerId: string): Car[] {
  return CARS.filter((c) => c.ownerId === ownerId);
}

export function carById(id: string): Car | undefined {
  return CARS.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// Social feed (6 posts)
// ---------------------------------------------------------------------------

export const POSTS: FeedPost[] = [];

// ---------------------------------------------------------------------------
// Club events (8)
// ---------------------------------------------------------------------------

export const CLUB_EVENTS: ClubEvent[] = [];

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const NOTIFICATIONS: AppNotification[] = [];

// ---------------------------------------------------------------------------
// Logged-in member profile (mock auth user)
// ---------------------------------------------------------------------------

export const MEMBER_PROFILE: MemberProfile = {
  id: '', name: '', firstName: '', lastName: '', email: '', phone: '', initials: '', tier: 'Member',
  membershipNumber: '', bio: '', location: '', joinDate: new Date().toISOString().slice(0, 10), verified: false,
  stats: { cars: 0, events: 0, posts: 0 },
  preferences: { newsletter: true, eventReminders: true, garageUpdates: true, marketplace: true, emailNotifications: true },
  privacy: { publicProfile: true, publicGarage: true },
  role: 'member', roleLabel: 'Member', permissions: [], status: 'Active', totpEnabled: false, hasPassword: true,
  connections: { google: false, facebook: false }, emailVerified: true, membershipExpires: null, chapterCountry: null, tierId: null,
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export const eur = (n: number): string =>
  n.toLocaleString('en-IE', { style: 'currency', currency: SETTINGS.club?.currency || 'EUR', maximumFractionDigits: 0 });

/** Parses ISO strings; date-only values ('2027-05-23') are read as local dates so they never shift a day. */
export function parseDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return parseDate(iso).toLocaleDateString('en-GB', opts ?? { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Relative time like "2h ago" for feed timestamps. */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.round(diff / 60000));
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(iso, { day: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// Marketplace listings (admin demo data)
// ---------------------------------------------------------------------------

export type ListingStatus = 'Active' | 'Pending' | 'Sold' | 'Rejected';

export interface MarketplaceListing {
  id: string;
  title: string;
  sellerId: string; // ClubMember.id
  price: number; // EUR
  condition: string;
  category: string;
  status: ListingStatus;
  image: string;
  listedAt: string; // ISO
  description?: string;
  buyerId?: string | null;
}

export const MARKETPLACE_LISTINGS: MarketplaceListing[] = [];

// ---------------------------------------------------------------------------
// Global member geography — heat map data
// ---------------------------------------------------------------------------

export interface MemberGeo {
  isoA3: string;
  isoN: string; // ISO 3166-1 numeric, matches world-atlas country ids
  name: string;
  members: number;
  chapters: number;
  continent: string;
  growth: number; // YoY member growth %
}

export interface MemberCity {
  city: string;
  country: string;
  members: number;
  coordinates: [number, number]; // [lon, lat]
}

export const MEMBER_GEO: MemberGeo[] = [];

export const MEMBER_CITIES: MemberCity[] = [];
export const TIERS: Tier[] = [];
export const SETTINGS = {} as PublicSettings;

export const totalMembers = (): number =>
  MEMBER_GEO.reduce((sum, g) => sum + g.members, 0);

export const countriesWithMembers = (): number => MEMBER_GEO.length;

export const totalChapters = (): number =>
  MEMBER_GEO.reduce((sum, g) => sum + g.chapters, 0);

export const continentsWithMembers = (): number =>
  new Set(MEMBER_GEO.map((g) => g.continent)).size;

export const topCityForCountry = (country: string): MemberCity | undefined =>
  MEMBER_CITIES.filter((c) => c.country === country).sort((a, b) => b.members - a.members)[0];

export const maxCountryMembers = (): number =>
  Math.max(1, ...MEMBER_GEO.map((g) => g.members));

/** First photo of a car, or a neutral placeholder. */
export const carPhoto = (car: Pick<Car, 'photos'>, i = 0): string =>
  car.photos?.[i] || `${import.meta.env.BASE_URL}car-placeholder.svg`;
