// Bundles server/scripts/seed-source.ts (original mock data) and writes server/seed.json.
// Usage: node server/scripts/gen-seed.mjs  (run from repo root, after app deps installed)
import { build } from '../../app/node_modules/esbuild/lib/main.js';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = join(mkdtempSync(join(tmpdir(), 'seed-')), 'data.mjs');
await build({ entryPoints: [process.argv[2] || 'server/scripts/seed-source.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out,
  define: { 'import.meta.env.BASE_URL': '"/"' } });
const d = await import(pathToFileURL(out).href);
const addYears = (iso, y) => { const dt = new Date(iso); dt.setUTCFullYear(dt.getUTCFullYear() + y); return iso.length <= 10 ? dt.toISOString().slice(0, 10) : dt.toISOString(); };
// Shift posts so the newest is ~2 days before seeding time; done at seed time instead (keep originals + offset).
const seed = {
  members: d.MEMBERS,
  profile: d.MEMBER_PROFILE,
  cars: d.CARS,
  posts: d.POSTS,
  events: d.CLUB_EVENTS.map((e) => ({ ...e, title: e.title.replace(/\b2025\b/g, '2027'), description: e.description.replace(/\b2025\b/g, '2027'), startDate: addYears(e.startDate, 2), endDate: addYears(e.endDate, 2) })),
  notifications: d.NOTIFICATIONS,
  listings: d.MARKETPLACE_LISTINGS.map((l) => ({ ...l, listedAt: addYears(l.listedAt, 2) })),
  geo: d.MEMBER_GEO,
  cities: d.MEMBER_CITIES,
};
writeFileSync('server/seed.json', JSON.stringify(seed, null, 1));
console.log('seed.json written:', Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, Array.isArray(v) ? v.length : 1])));
