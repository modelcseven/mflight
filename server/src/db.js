import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { config } from './config.js';
import { DEFAULT_SETTINGS } from './settings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Postgres returns numeric as string; parse to float (prices fit comfortably).
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
// Return DATE columns as plain 'YYYY-MM-DD' strings (no TZ shifting).
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

export const q = (text, params) => pool.query(text, params);
export const one = async (text, params) => (await pool.query(text, params)).rows[0] ?? null;
export const many = async (text, params) => (await pool.query(text, params)).rows;

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await fn(client);
    await client.query('COMMIT');
    return res;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export const newId = (prefix) => `${prefix}-${crypto.randomBytes(6).toString('hex')}`;

export async function migrate() {
  await q(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())`);
  const dir = join(ROOT, 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const done = await one('SELECT 1 FROM schema_migrations WHERE name=$1', [f]);
    if (done) continue;
    const sql = readFileSync(join(dir, f), 'utf8');
    await tx(async (c) => {
      await c.query(sql);
      await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
    });
    console.log(`[db] applied migration ${f}`);
  }
}

const TIERS = [
  { id: 'platinum', name: 'Platinum Member', price: 249, color: '#C9A227', sort: 1, def: false,
    benefits: ['Priority event booking', 'Paddock club access', '15% partner discounts', 'Free marketplace listings'] },
  { id: 'gold', name: 'Gold Member', price: 149, color: '#B08D57', sort: 2, def: false,
    benefits: ['Early event booking', '10% partner discounts', 'Club magazine'] },
  { id: 'standard', name: 'Club Member', price: 79, color: '#1C69D4', sort: 3, def: true,
    benefits: ['Club feed & garage', 'Event access', 'Marketplace access'] },
];

const randomPassword = () => crypto.randomBytes(9).toString('base64url');

/** Seeds an empty database with club data, tiers, settings and the first super admin. */
export async function seedIfEmpty() {
  const existing = await one('SELECT count(*)::int AS n FROM users');
  if (existing.n > 0) return;
  const seed = JSON.parse(readFileSync(join(ROOT, 'seed.json'), 'utf8'));
  console.log('[db] empty database — seeding club data');

  await tx(async (c) => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await c.query('INSERT INTO settings(key,value) VALUES ($1,$2) ON CONFLICT DO NOTHING', [key, value]);
    }
    for (const t of TIERS) {
      await c.query(
        'INSERT INTO tiers(id,name,price_yearly,benefits,color,sort,is_default) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [t.id, t.name, t.price, JSON.stringify(t.benefits), t.color, t.sort, t.def],
      );
    }

    // Demo members (no password -> cannot sign in until an admin resets / they use "forgot password").
    const demoHash = config.demoPassword ? await bcrypt.hash(config.demoPassword, 10) : null;
    const profile = seed.profile;
    for (const m of seed.members) {
      const country = m.location.split(',').pop().trim();
      const isProfile = m.id === profile.id;
      await c.query(
        `INSERT INTO users(id,email,password_hash,role,status,first_name,last_name,membership_number,tier_id,chapter_country,
           location,bio,phone,join_date,membership_expires,verified,email_verified,stats_base)
         VALUES ($1,$2,$3,'member',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true,$16)`,
        [
          m.id,
          isProfile ? profile.email : `${m.firstName}.${m.lastName}@example.com`.toLowerCase(),
          demoHash,
          m.verified ? 'Active' : 'Pending',
          m.firstName,
          m.lastName,
          m.membershipNumber,
          isProfile ? 'platinum' : m.verified ? 'gold' : 'standard',
          country,
          m.location,
          isProfile ? profile.bio : '',
          isProfile ? profile.phone : '',
          m.joinDate,
          '2027-12-31',
          m.verified,
          JSON.stringify(m.stats),
        ],
      );
    }

    // First super admin.
    const adminEmail = config.adminEmail;
    const adminPassword = config.adminPassword || randomPassword();
    await c.query(
      `INSERT INTO users(id,email,password_hash,role,status,first_name,last_name,membership_number,tier_id,location,
         verified,email_verified,membership_expires)
       VALUES ('u-admin',$1,$2,'super_admin','Active',$3,$4,'MFC-00001','platinum',$5,true,true,'2099-12-31')`,
      [adminEmail, await bcrypt.hash(adminPassword, 10), config.adminFirstName, config.adminLastName, 'Leander, United States'],
    );
    if (!config.adminPassword) {
      console.log('==================================================================');
      console.log(`[seed] SUPER ADMIN created: ${adminEmail}  password: ${adminPassword}`);
      console.log('[seed] Set ADMIN_PASSWORD env to control this. Change it after first sign-in.');
      console.log('==================================================================');
    }

    for (const car of seed.cars) {
      const { id, ownerId, ...data } = car;
      await c.query('INSERT INTO cars(id,owner_id,data,featured) VALUES ($1,$2,$3,$4)', [id, ownerId, data, id === 'm4-competition']);
    }

    // Shift post timestamps so the newest post is about a day old.
    const newest = Math.max(...seed.posts.map((p) => Date.parse(p.createdAt)));
    const shift = Date.now() - 86400000 - newest;
    for (const p of seed.posts) {
      await c.query(
        'INSERT INTO posts(id,author_id,text,image,base_likes,base_comments,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [p.id, p.authorId, p.text, p.image ?? null, p.likes, p.comments, new Date(Date.parse(p.createdAt) + shift)],
      );
    }

    for (const [i, e] of seed.events.entries()) {
      await c.query(
        `INSERT INTO events(id,title,location,country,nearest_airport,start_date,end_date,image,category,description,package_price,perks,
           capacity,base_attendees,featured)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [e.id, e.title, e.location, e.location.split(',').pop().trim(), e.nearestAirport, e.startDate, e.endDate, e.image,
          e.category, e.description, e.packagePrice, JSON.stringify(e.perks), e.seatsLeft + e.baseAttendees, e.baseAttendees, i === 0],
      );
    }

    for (const l of seed.listings) {
      await c.query(
        'INSERT INTO listings(id,title,seller_id,price,condition,category,status,image,listed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [l.id, l.title, l.sellerId, l.price, l.condition, l.category, l.status, l.image, l.listedAt],
      );
    }

    for (const g of seed.geo) {
      await c.query(
        'INSERT INTO geo_countries(iso_a3,iso_n,name,members,chapters,continent,growth) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [g.isoA3, g.isoN, g.name, g.members, g.chapters, g.continent, g.growth],
      );
    }
    for (const ct of seed.cities) {
      await c.query('INSERT INTO geo_cities(city,country,members,lon,lat) VALUES ($1,$2,$3,$4,$5)',
        [ct.city, ct.country, ct.members, ct.coordinates[0], ct.coordinates[1]]);
    }

    // Club-wide welcome notifications (visible to everyone).
    for (const n of seed.notifications.slice(0, 2)) {
      await c.query('INSERT INTO notifications(user_id,title,body) VALUES (NULL,$1,$2)', [n.title, n.body]);
    }
    await c.query(`INSERT INTO notifications(user_id,title,body,link) VALUES (NULL,'Welcome to MFlight','Your club home for events, garages and the marketplace.','/dashboard')`);
  });
  console.log('[db] seed complete');
}
