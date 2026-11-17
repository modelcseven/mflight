import { one, q, many } from './db.js';

/** Default settings rows, keyed by settings.key. Secret fields are listed in SECRET_FIELDS. */
export const DEFAULT_SETTINGS = {
  club: {
    name: 'MFlight',
    clubName: 'BMW Car Club Europe',
    tagline: 'Where the club takes you',
    logoUrl: '/club-emblem.svg',
    primaryColor: '#0066B1',
    accentColor: '#C9A227',
    contactEmail: 'info@mflight.club',
    currency: 'EUR',
    timezone: 'Europe/Berlin',
    supportUrl: '',
  },
  membership: {
    renewalReminderDays: 30,
    gracePeriodDays: 14,
    autoSuspendExpired: false,
    numberPrefix: 'MFC-',
  },
  positions: {
    list: ['President', 'Vice President', 'Secretary', 'Treasurer', 'Events Director', 'Membership Director', 'Marketing Director', 'Webmaster'],
  },
  events: {
    categories: ['Festival', 'Track Day', 'Tour', 'Rally', 'Lifestyle'],
    defaultCapacity: 40,
    maxGuests: 4,
    maxCars: 3,
    enableWaitlist: true,
  },
  marketplace: {
    requireApproval: true,
    feePercent: 0,
    categories: ['Car', 'Parts', 'Wheels', 'Interior', 'Performance', 'Exterior', 'Merch'],
    conditions: ['New', 'Used - Like New', 'Used - Good', 'Used - Fair'],
    maxActivePerMember: 10,
  },
  auth: {
    allowSignup: true,
    requireApproval: false,
    requireEmailVerification: false,
    googleEnabled: false,
    googleClientId: '',
    googleClientSecret: '',
    facebookEnabled: false,
    facebookAppId: '',
    facebookAppSecret: '',
  },
  smtp: {
    enabled: false,
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from: 'MFlight <no-reply@mflight.club>',
  },
  stripe: {
    enabled: false,
    publishableKey: '',
    secretKey: '',
    webhookSecret: '',
  },
  ai: {
    enabled: false,
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
  },
};

export const SECRET_FIELDS = {
  auth: ['googleClientSecret', 'facebookAppSecret'],
  smtp: ['pass'],
  stripe: ['secretKey', 'webhookSecret'],
  ai: ['apiKey'],
};

/** Keys only super admins may change. */
export const SUPER_ONLY_KEYS = ['auth', 'smtp', 'stripe', 'ai', 'positions'];

export const MASK = '••••••••';

export async function getSetting(key) {
  const row = await one('SELECT value FROM settings WHERE key=$1', [key]);
  return { ...(DEFAULT_SETTINGS[key] || {}), ...(row?.value || {}) };
}

export async function getAllSettings() {
  const rows = await many('SELECT key, value FROM settings');
  const out = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) out[k] = { ...DEFAULT_SETTINGS[k] };
  for (const r of rows) out[r.key] = { ...(out[r.key] || {}), ...r.value };
  return out;
}

/** Settings with secret values replaced by a mask (for the admin UI). */
export function maskSettings(all) {
  const out = structuredClone(all);
  for (const [k, fields] of Object.entries(SECRET_FIELDS)) {
    for (const f of fields) if (out[k]?.[f]) out[k][f] = MASK;
  }
  return out;
}

export async function putSetting(key, patch) {
  const cur = await getSetting(key);
  const next = { ...cur };
  for (const [f, v] of Object.entries(patch)) {
    if ((SECRET_FIELDS[key] || []).includes(f) && v === MASK) continue; // unchanged secret
    next[f] = v;
  }
  await q(
    `INSERT INTO settings(key,value,updated_at) VALUES ($1,$2,now())
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
    [key, next],
  );
  return next;
}

/** Non-secret settings any visitor may read (branding, sign-in options, categories). */
export async function publicSettings() {
  const all = await getAllSettings();
  return {
    club: all.club,
    events: all.events,
    marketplace: all.marketplace,
    membership: { numberPrefix: all.membership.numberPrefix },
    positions: { list: all.positions?.list ?? [] },
    auth: {
      allowSignup: all.auth.allowSignup,
      google: !!(all.auth.googleEnabled && all.auth.googleClientId && all.auth.googleClientSecret),
      facebook: !!(all.auth.facebookEnabled && all.auth.facebookAppId && all.auth.facebookAppSecret),
    },
    payments: { stripe: !!(all.stripe.enabled && all.stripe.secretKey) },
    ai: { enabled: !!(all.ai.enabled && all.ai.apiKey && all.ai.baseUrl) },
  };
}
