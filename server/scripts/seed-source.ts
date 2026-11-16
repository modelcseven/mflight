/**
 * MFlight mock data — BMW Car Club Europe members-only social platform.
 * All content is static/deterministic — no backend.
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
}

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
}

export interface FeedPost {
  id: string;
  authorId: string; // ClubMember.id
  text: string;
  image?: string;
  createdAt: string; // ISO
  likes: number;
  comments: number;
}

export interface ClubEvent {
  id: string;
  title: string;
  location: string;
  nearestAirport: string; // IATA
  startDate: string; // ISO
  endDate: string; // ISO
  image: string;
  category: 'Festival' | 'Track Day' | 'Tour' | 'Rally' | 'Lifestyle';
  description: string;
  packagePrice: number; // EUR per person, travel package
  perks: string[];
  seatsLeft: number;
  /** Deterministic members already attending (before the signed-in member's RSVP). */
  baseAttendees: number;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
}

export interface MemberProfile {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  initials: string;
  tier: 'Platinum Member';
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
    publicProfile: boolean;
  };
}

// ---------------------------------------------------------------------------
// Club members (6)
// ---------------------------------------------------------------------------

export const MEMBERS: ClubMember[] = [
  {
    id: 'm-alex-berger',
    name: 'Alex Berger',
    firstName: 'Alex',
    lastName: 'Berger',
    membershipNumber: 'MFC-04217',
    location: 'Munich, Germany',
    joinDate: '2016-03-14',
    avatarInitials: 'AB',
    verified: true,
    stats: { cars: 2, events: 23, posts: 41 },
  },
  {
    id: 'm-sophie-lindqvist',
    name: 'Sophie Lindqvist',
    firstName: 'Sophie',
    lastName: 'Lindqvist',
    membershipNumber: 'MFC-01198',
    location: 'Stockholm, Sweden',
    joinDate: '2011-06-02',
    avatarInitials: 'SL',
    verified: true,
    stats: { cars: 1, events: 37, posts: 88 },
  },
  {
    id: 'm-marco-rossi',
    name: 'Marco Rossi',
    firstName: 'Marco',
    lastName: 'Rossi',
    membershipNumber: 'MFC-02763',
    location: 'Milan, Italy',
    joinDate: '2014-09-21',
    avatarInitials: 'MR',
    verified: true,
    stats: { cars: 1, events: 19, posts: 52 },
  },
  {
    id: 'm-elena-petrova',
    name: 'Elena Petrova',
    firstName: 'Elena',
    lastName: 'Petrova',
    membershipNumber: 'MFC-03541',
    location: 'Vienna, Austria',
    joinDate: '2018-04-09',
    avatarInitials: 'EP',
    verified: false,
    stats: { cars: 0, events: 11, posts: 27 },
  },
  {
    id: 'm-jan-willems',
    name: 'Jan Willems',
    firstName: 'Jan',
    lastName: 'Willems',
    membershipNumber: 'MFC-00852',
    location: 'Amsterdam, Netherlands',
    joinDate: '2009-11-30',
    avatarInitials: 'JW',
    verified: true,
    stats: { cars: 1, events: 54, posts: 103 },
  },
  {
    id: 'm-claire-dubois',
    name: 'Claire Dubois',
    firstName: 'Claire',
    lastName: 'Dubois',
    membershipNumber: 'MFC-05109',
    location: 'Lyon, France',
    joinDate: '2021-02-17',
    avatarInitials: 'CD',
    verified: false,
    stats: { cars: 0, events: 6, posts: 14 },
  },
];

export function memberById(id: string): ClubMember | undefined {
  return MEMBERS.find((m) => m.id === id);
}

// ---------------------------------------------------------------------------
// Virtual garage (4 cars — the logged-in member owns the first two)
// ---------------------------------------------------------------------------

export const CARS: Car[] = [
  {
    id: 'm4-competition',
    ownerId: 'm-alex-berger',
    make: 'BMW',
    model: 'M4 Competition',
    year: 2024,
    engine: { code: 'S58B30T0', displacement: '3.0 L', hp: 510, torque: 650 },
    transmission: '8-speed M Steptronic',
    drivetrain: 'RWD',
    tires: { front: '275/35 ZR19', rear: '285/30 ZR20' },
    paint: { name: 'São Paulo Yellow', hex: '#C6D500' },
    wheels: '826M forged, 19"/20" Jet Black',
    suspension: 'Adaptive M suspension',
    exhaust: 'M Sport exhaust, titanium tips',
    modifications: [
      'Eventuri carbon intake',
      'KW HAS height-adjustable springs',
      'M Performance carbon front splitter',
    ],
    mileage: 14850,
    purchase: { date: '2024-03-02', price: 92400, dealer: 'BMW Niederlassung München' },
    photos: ['/cars/m4-competition-1.jpg', '/cars/m4-competition-2.jpg', '/cars/m4-competition-3.jpg'],
    aiInsights: [
      'S58 responds exceptionally well to downpipes + Stage 1 tune (~+90 hp) without reliability concerns.',
      '3 similar M4 Competition builds exist in the club — compare setups with Sophie and Jan.',
    ],
    semanticTags: ['m4', 'g82', 's58', 'track', 'yellow', 'coupe', 'competition'],
    suggestionSlots: ['similar-cars', 'mod-suggestions', 'trackday-setup'],
  },
  {
    id: 'm2-zandvoort',
    ownerId: 'm-alex-berger',
    make: 'BMW',
    model: 'M2',
    year: 2023,
    engine: { code: 'S58B30T0', displacement: '3.0 L', hp: 460, torque: 550 },
    transmission: '6-speed manual',
    drivetrain: 'RWD',
    tires: { front: '275/35 ZR19', rear: '285/30 ZR20' },
    paint: { name: 'Zandvoort Blue', hex: '#5A7BA6' },
    wheels: '930M Style, 19"/20" bicolor',
    suspension: 'Adaptive M suspension',
    exhaust: 'Stock M Sport exhaust',
    modifications: ['M Performance exhaust valve controller', 'BMC panel filter'],
    mileage: 22300,
    purchase: { date: '2023-06-15', price: 76800, dealer: 'BMW Niederlassung München' },
    photos: ['/cars/m2-zandvoort-1.jpg', '/cars/m2-zandvoort-2.jpg', '/cars/m2-zandvoort-3.jpg'],
    aiInsights: [
      'Manual G87 M2 values are holding strong — enthusiast demand for 3-pedal S58 cars is rising.',
    ],
    semanticTags: ['m2', 'g87', 's58', 'manual', 'blue', 'coupe', 'daily'],
    suggestionSlots: ['similar-cars', 'mod-suggestions'],
  },
  {
    id: 'e46-m3',
    ownerId: 'm-jan-willems',
    make: 'BMW',
    model: 'M3 (E46)',
    year: 2003,
    engine: { code: 'S54B32', displacement: '3.2 L', hp: 343, torque: 365 },
    transmission: '6-speed manual',
    drivetrain: 'RWD',
    tires: { front: '225/40 ZR19', rear: '255/35 ZR19' },
    paint: { name: 'Laguna Seca Blue', hex: '#1F4E9E' },
    wheels: 'Style 67, 19" silver',
    suspension: 'Bilstein B16 coilovers',
    exhaust: 'Supersprint cat-back',
    modifications: [
      'Rod bearings replaced (2022)',
      'Subframe reinforcement kit',
      'Supersprint headers',
      'Alcantara steering wheel retrim',
    ],
    mileage: 118400,
    purchase: { date: '2015-05-20', price: 32500, dealer: 'Private sale, Utrecht' },
    photos: ['/cars/e46-m3-1.jpg', '/cars/e46-m3-2.jpg', '/cars/e46-m3-3.jpg'],
    aiInsights: [
      'S54 maintenance is up to date — next interval: valve adjustment at 130,000 km.',
      'Laguna Seca Blue E46 M3s appreciated ~18% over the last 3 years.',
    ],
    semanticTags: ['e46', 'm3', 's54', 'classic', 'manual', 'blue', 'collector'],
    suggestionSlots: ['similar-cars', 'value-trend', 'maintenance-reminders'],
  },
  {
    id: 'm8-grancoupe',
    ownerId: 'm-marco-rossi',
    make: 'BMW',
    model: 'M8 Gran Coupé',
    year: 2022,
    engine: { code: 'S63B44T4', displacement: '4.4 L', hp: 625, torque: 750 },
    transmission: '8-speed M Steptronic',
    drivetrain: 'AWD (M xDrive)',
    tires: { front: '275/35 ZR20', rear: '285/35 ZR20' },
    paint: { name: 'Frozen Dark Silver', hex: '#6E747B' },
    wheels: '813M forged, 20" Orbit Grey',
    suspension: 'Adaptive M suspension Professional',
    exhaust: 'M Sport exhaust',
    modifications: ['M Carbon exterior package', 'Bowers & Wilkins Diamond audio'],
    mileage: 31700,
    purchase: { date: '2022-09-08', price: 158900, dealer: 'BMW Milano' },
    photos: ['/cars/m8-grancoupe-1.jpg', '/cars/m8-grancoupe-2.jpg', '/cars/m8-grancoupe-3.jpg'],
    aiInsights: [
      'Frozen paints need pH-neutral wash only — avoid automatic car washes with brushes.',
    ],
    semanticTags: ['m8', 'f93', 's63', 'gran-coupe', 'luxury', 'gt', 'frozen'],
    suggestionSlots: ['similar-cars', 'care-tips'],
  },
];

export function carsByOwner(ownerId: string): Car[] {
  return CARS.filter((c) => c.ownerId === ownerId);
}

export function carById(id: string): Car | undefined {
  return CARS.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// Social feed (6 posts)
// ---------------------------------------------------------------------------

export const POSTS: FeedPost[] = [
  {
    id: 'post-1',
    authorId: 'm-alex-berger',
    text: 'First proper shakedown of the M4 at the Nordschleife yesterday. The S58 pulls relentlessly out of Bergwerk — KW springs transformed the front-end bite. Who else is in for the August track day?',
    image: '/cars/m4-competition-1.jpg',
    createdAt: '2025-04-26T18:42:00Z',
    likes: 47,
    comments: 12,
  },
  {
    id: 'post-2',
    authorId: 'm-jan-willems',
    text: 'Ten years with the E46 today. 118,000 km of smiles, one subframe reinforcement, zero regrets. Laguna Seca Blue still stops traffic at every fuel stop.',
    image: '/cars/e46-m3-1.jpg',
    createdAt: '2025-04-25T09:15:00Z',
    likes: 132,
    comments: 31,
  },
  {
    id: 'post-3',
    authorId: 'm-sophie-lindqvist',
    text: 'Grossglockner Alpine Tour registration is open! We did the sunrise summit drive last year and I still think about it weekly. Convoy limit is 25 cars — do not sleep on it.',
    createdAt: '2025-04-24T14:03:00Z',
    likes: 68,
    comments: 19,
  },
  {
    id: 'post-4',
    authorId: 'm-marco-rossi',
    text: 'Detail day for the M8 Gran Coupé. Frozen Dark Silver demands patience — pH-neutral wash, two-bucket method, matte sealant. Worth every minute when the evening light hits it.',
    image: '/cars/m8-grancoupe-1.jpg',
    createdAt: '2025-04-22T16:58:00Z',
    likes: 54,
    comments: 8,
  },
  {
    id: 'post-5',
    authorId: 'm-alex-berger',
    text: 'Took the M2 over the Stelvio at 6am to beat the cyclists. Third gear, 4,000 rpm, manual box — this is why we buy these cars. Zandvoort Blue photographs ridiculously well up there.',
    image: '/cars/m2-zandvoort-1.jpg',
    createdAt: '2025-04-20T07:31:00Z',
    likes: 91,
    comments: 15,
  },
  {
    id: 'post-6',
    authorId: 'm-claire-dubois',
    text: 'New member here — just picked up my welcome pack at the Lyon chapter meet. Already signed up for the Côte d’Azur Coastal Rally. Any tips for a first-timer on a regularity format?',
    createdAt: '2025-04-18T11:20:00Z',
    likes: 36,
    comments: 22,
  },
];

// ---------------------------------------------------------------------------
// Club events (8)
// ---------------------------------------------------------------------------

export const CLUB_EVENTS: ClubEvent[] = [
  {
    id: 'm-festival-2025',
    title: 'BMW M Festival 2025',
    location: 'Munich, Germany',
    nearestAirport: 'MUC',
    startDate: '2025-07-18',
    endDate: '2025-07-20',
    image: '/event-m-festival.jpg',
    category: 'Festival',
    description:
      'The flagship gathering of the M community. Three days of M Town displays, hot-lap taxi rides, live music, and the unveiling of next season’s M lineup on the festival ground at the Olympiapark.',
    packagePrice: 1240,
    perks: ['Paddock club access', 'M taxi hot laps', 'Welcome dinner', 'Festival camping option'],
    seatsLeft: 14,
    baseAttendees: 25,
  },
  {
    id: 'nordschleife-trackday',
    title: 'Nordschleife Track Day',
    location: 'Nürburg, Germany',
    nearestAirport: 'FRA',
    startDate: '2025-08-09',
    endDate: '2025-08-10',
    image: '/event-nordschleife.jpg',
    category: 'Track Day',
    description:
      'A full club-exclusive day on the Green Hell. Four open-pit sessions, professional instruction groups by skill level, and an evening at the legendary Pistenklause.',
    packagePrice: 1890,
    perks: ['4 open sessions', 'Pro instruction', 'Dinner at Pistenklause', 'Transponder rental included'],
    seatsLeft: 6,
    baseAttendees: 11,
  },
  {
    id: 'alpine-tour-2025',
    title: 'Grossglockner Alpine Tour',
    location: 'Salzburg → Heiligenblut, Austria',
    nearestAirport: 'SZG',
    startDate: '2025-09-05',
    endDate: '2025-09-08',
    image: '/event-alpine-tour.jpg',
    category: 'Tour',
    description:
      'Four days over the High Alpine Road in convoy: 48 hairpins, Edelweissspitze sunrise drive, and boutique mountain hotels. The club’s most requested tour, three years running.',
    packagePrice: 2150,
    perks: ['Convoy lead & sweep cars', 'Boutique hotels', 'Sunrise summit drive', 'Road tolls included'],
    seatsLeft: 9,
    baseAttendees: 11,
  },
  {
    id: 'monaco-grand-weekend',
    title: 'Monaco Harbor Grand Weekend',
    location: 'Monte Carlo, Monaco',
    nearestAirport: 'NCE',
    startDate: '2025-05-23',
    endDate: '2025-05-26',
    image: '/event-monaco.jpg',
    category: 'Lifestyle',
    description:
      'A Riviera weekend timed with the Grand Prix: harbor-side viewing terrace, night drive along the Moyenne Corniche, and a members’ dinner overlooking Port Hercule.',
    packagePrice: 3480,
    perks: ['Harbor terrace tickets', 'Corniche night drive', 'Members’ dinner', '5-star harbor hotel'],
    seatsLeft: 4,
    baseAttendees: 29,
  },
  {
    id: 'goodwood-revival',
    title: 'Goodwood Revival Weekend',
    location: 'Chichester, United Kingdom',
    nearestAirport: 'LHR',
    startDate: '2025-09-12',
    endDate: '2025-09-14',
    image: '/event-goodwood.jpg',
    category: 'Festival',
    description:
      'Period dress, historic racing, and the club’s own paddock display. We take a line of classic and modern BMWs onto the Revival show field with member hospitality all weekend.',
    packagePrice: 1640,
    perks: ['Show-field display pass', 'Member hospitality', 'Period dress hire', 'Saturday gala'],
    seatsLeft: 18,
    baseAttendees: 11,
  },
  {
    id: 'bmw-welt-heritage',
    title: 'BMW Welt & Museum Heritage Day',
    location: 'Munich, Germany',
    nearestAirport: 'MUC',
    startDate: '2025-10-11',
    endDate: '2025-10-11',
    image: '/event-munich.jpg',
    category: 'Lifestyle',
    description:
      'A behind-the-velvet-rope evening at BMW Welt: private Museum tour, factory line walk, and dinner in the double-cone with the club’s honorary members.',
    packagePrice: 420,
    perks: ['Private museum tour', 'Factory line walk', 'Double-cone dinner', 'Valet parking'],
    seatsLeft: 32,
    baseAttendees: 14,
  },
  {
    id: 'cote-dazur-rally',
    title: 'Côte d’Azur Coastal Rally',
    location: 'Nice → Saint-Tropez, France',
    nearestAirport: 'NCE',
    startDate: '2025-06-13',
    endDate: '2025-06-15',
    image: '/event-monaco.jpg',
    category: 'Rally',
    description:
      'A gentle navigation rally along the corniches and through the Verdon gorge. Regularity format — no racing, all scenery — finishing with a beach club lunch in Saint-Tropez.',
    packagePrice: 1380,
    perks: ['Roadbook & rally plates', 'Beach club finale', 'Support van', '2 nights seafront hotel'],
    seatsLeft: 11,
    baseAttendees: 14,
  },
  {
    id: 'innsbruck-winter-drive',
    title: 'Innsbruck Winter Driving Experience',
    location: 'Innsbruck, Austria',
    nearestAirport: 'INN',
    startDate: '2026-01-16',
    endDate: '2026-01-18',
    image: '/event-alpine-tour.jpg',
    category: 'Track Day',
    description:
      'Ice-driving fundamentals on a prepared circuit in the Tyrolean Alps. Studded M cars, professional instructors, and a fireside schnitzel dinner to close the season.',
    packagePrice: 1720,
    perks: ['Studded M fleet', '1:4 instructor ratio', 'Fireside dinner', 'Ski-day add-on available'],
    seatsLeft: 22,
    baseAttendees: 23,
  },
];

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    title: 'Nordschleife Track Day — 6 places left',
    body: 'The August track day is nearly full. Members get priority booking until Friday.',
    time: '2h ago',
    unread: true,
  },
  {
    id: 'n2',
    title: 'Jan Willems liked your post',
    body: 'Your M4 shakedown post is trending in the club feed — 47 likes and counting.',
    time: '5h ago',
    unread: true,
  },
  {
    id: 'n3',
    title: 'Garage insight ready',
    body: 'New AI insight for your M4 Competition: 3 similar builds in the club to compare setups with.',
    time: '1d ago',
    unread: true,
  },
  {
    id: 'n4',
    title: 'Alpine Tour convoy confirmed',
    body: 'You are car #12 in the Grossglockner convoy. Roadbook and hotel details are in your inbox.',
    time: '3d ago',
    unread: false,
  },
  {
    id: 'n5',
    title: 'Welcome Claire Dubois',
    body: 'A new member joined the Lyon chapter. Say hello and share your rally tips.',
    time: '4d ago',
    unread: false,
  },
];

// ---------------------------------------------------------------------------
// Logged-in member profile (mock auth user)
// ---------------------------------------------------------------------------

export const MEMBER_PROFILE: MemberProfile = {
  id: 'm-alex-berger',
  name: 'Alex Berger',
  firstName: 'Alex',
  lastName: 'Berger',
  email: 'alex.berger@example.com',
  phone: '+49 89 555 0421',
  initials: 'AB',
  tier: 'Platinum Member',
  membershipNumber: 'MFC-04217',
  bio: 'M enthusiast since the E46 era. Track days in summer, alpine passes in autumn. Currently splitting seat time between an M4 Competition and a manual M2.',
  location: 'Munich, Germany',
  joinDate: '2016-03-14',
  verified: true,
  stats: { cars: 2, events: 23, posts: 41 },
  preferences: {
    newsletter: true,
    eventReminders: true,
    garageUpdates: true,
    publicProfile: false,
  },
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export const eur = (n: number): string =>
  n.toLocaleString('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString('en-GB', opts ?? { day: 'numeric', month: 'short', year: 'numeric' });
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

export type ListingStatus = 'Active' | 'Pending' | 'Sold';

export interface MarketplaceListing {
  id: string;
  title: string;
  sellerId: string; // ClubMember.id
  price: number; // EUR
  condition: 'New' | 'Used - Like New' | 'Used - Good' | 'Used - Fair';
  category:
    | 'Car'
    | 'Parts'
    | 'Wheels'
    | 'Interior'
    | 'Performance'
    | 'Exterior'
    | 'Merch';
  status: ListingStatus;
  image: string;
  listedAt: string; // ISO
}

export const MARKETPLACE_LISTINGS: MarketplaceListing[] = [
  {
    id: 'ml-m4-seats',
    title: 'BMW M4 Competition carbon bucket seats (G82)',
    sellerId: 'm-alex-berger',
    price: 6900,
    condition: 'Used - Like New',
    category: 'Interior',
    status: 'Pending',
    image: '/cars/m4-competition-2.jpg',
    listedAt: '2024-11-02T10:00:00Z',
  },
  {
    id: 'ml-e46-m3',
    title: '2003 BMW M3 (E46) Laguna Seca Blue — collector condition',
    sellerId: 'm-jan-willems',
    price: 48500,
    condition: 'Used - Good',
    category: 'Car',
    status: 'Active',
    image: '/cars/e46-m3-1.jpg',
    listedAt: '2024-10-18T09:30:00Z',
  },
  {
    id: 'ml-826m-wheels',
    title: '826M forged wheel set 19"/20" Jet Black with Michelin PS4S',
    sellerId: 'm-sophie-lindqvist',
    price: 3200,
    condition: 'Used - Like New',
    category: 'Wheels',
    status: 'Active',
    image: '/cars/m4-competition-3.jpg',
    listedAt: '2024-10-27T15:45:00Z',
  },
  {
    id: 'ml-m2-exhaust',
    title: 'M Performance titanium exhaust — G87 M2',
    sellerId: 'm-marco-rossi',
    price: 2450,
    condition: 'Used - Good',
    category: 'Performance',
    status: 'Pending',
    image: '/cars/m2-zandvoort-2.jpg',
    listedAt: '2024-11-05T18:10:00Z',
  },
  {
    id: 'ml-style67',
    title: 'E46 M3 Style 67 wheel set, refinished silver',
    sellerId: 'm-claire-dubois',
    price: 980,
    condition: 'Used - Fair',
    category: 'Wheels',
    status: 'Sold',
    image: '/cars/e46-m3-3.jpg',
    listedAt: '2024-09-12T11:20:00Z',
  },
  {
    id: 'ml-m8-grancoupe',
    title: '2022 BMW M8 Gran Coupé — Frozen Dark Silver, full BMW warranty',
    sellerId: 'm-elena-petrova',
    price: 112000,
    condition: 'Used - Like New',
    category: 'Car',
    status: 'Active',
    image: '/cars/m8-grancoupe-1.jpg',
    listedAt: '2024-10-30T08:00:00Z',
  },
  {
    id: 'ml-m2-spoiler',
    title: 'M Performance carbon rear spoiler — G87 M2',
    sellerId: 'm-marco-rossi',
    price: 1150,
    condition: 'New',
    category: 'Exterior',
    status: 'Active',
    image: '/cars/m2-zandvoort-1.jpg',
    listedAt: '2024-11-08T12:00:00Z',
  },
  {
    id: 'ml-club-jacket',
    title: 'BMW Car Club Europe softshell jacket — navy/gold',
    sellerId: 'm-sophie-lindqvist',
    price: 85,
    condition: 'New',
    category: 'Merch',
    status: 'Active',
    image: '/cars/m2-zandvoort-3.jpg',
    listedAt: '2024-11-10T09:00:00Z',
  },
];

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

export const MEMBER_GEO: MemberGeo[] = [
  { isoA3: 'DEU', isoN: '276', name: 'Germany', members: 480, chapters: 14, continent: 'Europe', growth: 12.4 },
  { isoA3: 'GBR', isoN: '826', name: 'United Kingdom', members: 240, chapters: 8, continent: 'Europe', growth: 9.1 },
  { isoA3: 'USA', isoN: '840', name: 'United States', members: 210, chapters: 6, continent: 'North America', growth: 15.8 },
  { isoA3: 'FRA', isoN: '250', name: 'France', members: 190, chapters: 6, continent: 'Europe', growth: 8.6 },
  { isoA3: 'ITA', isoN: '380', name: 'Italy', members: 165, chapters: 5, continent: 'Europe', growth: 11.2 },
  { isoA3: 'ESP', isoN: '724', name: 'Spain', members: 140, chapters: 4, continent: 'Europe', growth: 13.7 },
  { isoA3: 'NLD', isoN: '528', name: 'Netherlands', members: 120, chapters: 4, continent: 'Europe', growth: 7.4 },
  { isoA3: 'AUT', isoN: '040', name: 'Austria', members: 110, chapters: 3, continent: 'Europe', growth: 6.9 },
  { isoA3: 'CHE', isoN: '756', name: 'Switzerland', members: 95, chapters: 3, continent: 'Europe', growth: 5.8 },
  { isoA3: 'BEL', isoN: '056', name: 'Belgium', members: 80, chapters: 2, continent: 'Europe', growth: 6.1 },
  { isoA3: 'SWE', isoN: '752', name: 'Sweden', members: 64, chapters: 2, continent: 'Europe', growth: 10.3 },
  { isoA3: 'POL', isoN: '616', name: 'Poland', members: 58, chapters: 2, continent: 'Europe', growth: 18.9 },
  { isoA3: 'NOR', isoN: '578', name: 'Norway', members: 44, chapters: 1, continent: 'Europe', growth: 7.7 },
  { isoA3: 'CAN', isoN: '124', name: 'Canada', members: 40, chapters: 2, continent: 'North America', growth: 12.1 },
  { isoA3: 'DNK', isoN: '208', name: 'Denmark', members: 38, chapters: 1, continent: 'Europe', growth: 5.2 },
  { isoA3: 'ARE', isoN: '784', name: 'United Arab Emirates', members: 45, chapters: 1, continent: 'Asia', growth: 22.6 },
  { isoA3: 'PRT', isoN: '620', name: 'Portugal', members: 36, chapters: 1, continent: 'Europe', growth: 9.8 },
  { isoA3: 'IRL', isoN: '372', name: 'Ireland', members: 34, chapters: 1, continent: 'Europe', growth: 6.4 },
  { isoA3: 'CZE', isoN: '203', name: 'Czechia', members: 32, chapters: 1, continent: 'Europe', growth: 14.5 },
  { isoA3: 'TUR', isoN: '792', name: 'Türkiye', members: 35, chapters: 1, continent: 'Asia', growth: 16.2 },
  { isoA3: 'JPN', isoN: '392', name: 'Japan', members: 30, chapters: 1, continent: 'Asia', growth: 10.9 },
  { isoA3: 'HUN', isoN: '348', name: 'Hungary', members: 26, chapters: 1, continent: 'Europe', growth: 8.1 },
  { isoA3: 'AUS', isoN: '036', name: 'Australia', members: 25, chapters: 1, continent: 'Oceania', growth: 11.6 },
  { isoA3: 'ROU', isoN: '642', name: 'Romania', members: 24, chapters: 1, continent: 'Europe', growth: 13.3 },
  { isoA3: 'FIN', isoN: '246', name: 'Finland', members: 22, chapters: 1, continent: 'Europe', growth: 4.7 },
  { isoA3: 'ZAF', isoN: '710', name: 'South Africa', members: 20, chapters: 1, continent: 'Africa', growth: 9.5 },
  { isoA3: 'GRC', isoN: '300', name: 'Greece', members: 18, chapters: 1, continent: 'Europe', growth: 7.0 },
  { isoA3: 'LUX', isoN: '442', name: 'Luxembourg', members: 12, chapters: 1, continent: 'Europe', growth: 3.4 },
];

export const MEMBER_CITIES: MemberCity[] = [
  { city: 'Munich', country: 'Germany', members: 210, coordinates: [11.582, 48.135] },
  { city: 'London', country: 'United Kingdom', members: 130, coordinates: [-0.1276, 51.5072] },
  { city: 'Paris', country: 'France', members: 95, coordinates: [2.3522, 48.8566] },
  { city: 'Milan', country: 'Italy', members: 80, coordinates: [9.19, 45.4642] },
  { city: 'Amsterdam', country: 'Netherlands', members: 70, coordinates: [4.9041, 52.3676] },
  { city: 'Los Angeles', country: 'United States', members: 60, coordinates: [-118.2437, 34.0522] },
  { city: 'Zurich', country: 'Switzerland', members: 60, coordinates: [8.5417, 47.3769] },
  { city: 'Vienna', country: 'Austria', members: 55, coordinates: [16.3738, 48.2082] },
  { city: 'Barcelona', country: 'Spain', members: 50, coordinates: [2.1734, 41.3851] },
  { city: 'Dubai', country: 'United Arab Emirates', members: 45, coordinates: [55.2708, 25.2048] },
  { city: 'Brussels', country: 'Belgium', members: 40, coordinates: [4.3517, 50.8503] },
  { city: 'Tokyo', country: 'Japan', members: 30, coordinates: [139.6917, 35.6895] },
  { city: 'Sydney', country: 'Australia', members: 25, coordinates: [151.2093, -33.8688] },
  { city: 'Cape Town', country: 'South Africa', members: 20, coordinates: [18.4241, -33.9249] },
];

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
  Math.max(...MEMBER_GEO.map((g) => g.members));
