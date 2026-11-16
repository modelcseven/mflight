-- MFlight schema v1
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tiers (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  price_yearly numeric(10,2) NOT NULL DEFAULT 0,
  benefits     jsonb NOT NULL DEFAULT '[]',
  color        text NOT NULL DEFAULT '#C9A227',
  sort         int NOT NULL DEFAULT 0,
  is_default   boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS users (
  id                 text PRIMARY KEY,
  email              citext UNIQUE NOT NULL,
  password_hash      text,
  role               text NOT NULL DEFAULT 'member'
                     CHECK (role IN ('super_admin','admin','chapter_lead','moderator','member')),
  status             text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Pending','Suspended')),
  first_name         text NOT NULL,
  last_name          text NOT NULL DEFAULT '',
  membership_number  text UNIQUE NOT NULL,
  tier_id            text REFERENCES tiers(id) ON DELETE SET NULL,
  chapter_country    text,
  location           text NOT NULL DEFAULT '',
  bio                text NOT NULL DEFAULT '',
  phone              text NOT NULL DEFAULT '',
  avatar_url         text,
  join_date          date NOT NULL DEFAULT current_date,
  membership_expires date,
  verified           boolean NOT NULL DEFAULT false,
  email_verified     boolean NOT NULL DEFAULT false,
  stats_base         jsonb NOT NULL DEFAULT '{"cars":0,"events":0,"posts":0}',
  prefs              jsonb NOT NULL DEFAULT '{"newsletter":true,"eventReminders":true,"garageUpdates":true,"marketplace":true,"emailNotifications":true}',
  privacy            jsonb NOT NULL DEFAULT '{"publicProfile":true,"showOnMap":true,"publicGarage":true,"showEmail":false}',
  totp_secret        text,
  totp_enabled       boolean NOT NULL DEFAULT false,
  google_id          text UNIQUE,
  facebook_id        text UNIQUE,
  token_version      int NOT NULL DEFAULT 0,
  last_login_at      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tokens (
  token_hash text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('reset','verify')),
  expires_at timestamptz NOT NULL,
  used       boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS geo_countries (
  iso_a3    text PRIMARY KEY,
  iso_n     text NOT NULL,
  name      text NOT NULL,
  members   int NOT NULL DEFAULT 0,
  chapters  int NOT NULL DEFAULT 0,
  continent text NOT NULL,
  growth    numeric(6,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS geo_cities (
  id      serial PRIMARY KEY,
  city    text NOT NULL,
  country text NOT NULL,
  members int NOT NULL DEFAULT 0,
  lon     double precision NOT NULL,
  lat     double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS cars (
  id         text PRIMARY KEY,
  owner_id   text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data       jsonb NOT NULL,
  featured   boolean NOT NULL DEFAULT false,
  hidden     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id              text PRIMARY KEY,
  author_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text            text NOT NULL,
  image           text,
  kind            text NOT NULL DEFAULT 'post',
  base_likes      int NOT NULL DEFAULT 0,
  base_comments   int NOT NULL DEFAULT 0,
  pinned          boolean NOT NULL DEFAULT false,
  hidden          boolean NOT NULL DEFAULT false,
  is_announcement boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id         text PRIMARY KEY,
  post_id    text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       text NOT NULL,
  hidden     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id          text PRIMARY KEY,
  target_type text NOT NULL CHECK (target_type IN ('post','comment','listing','user','car')),
  target_id   text NOT NULL,
  reporter_id text REFERENCES users(id) ON DELETE SET NULL,
  reason      text NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolved_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id              text PRIMARY KEY,
  title           text NOT NULL,
  location        text NOT NULL,
  country         text,
  nearest_airport text NOT NULL DEFAULT '',
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  image           text NOT NULL DEFAULT '',
  category        text NOT NULL,
  description     text NOT NULL DEFAULT '',
  package_price   numeric(10,2) NOT NULL DEFAULT 0,
  perks           jsonb NOT NULL DEFAULT '[]',
  capacity        int NOT NULL DEFAULT 40,
  base_attendees  int NOT NULL DEFAULT 0,
  featured        boolean NOT NULL DEFAULT false,
  cancelled       boolean NOT NULL DEFAULT false,
  published       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rsvps (
  id             text PRIMARY KEY,
  event_id       text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id        text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'going' CHECK (status IN ('going','waitlist','cancelled')),
  guests         int NOT NULL DEFAULT 0,
  cars           int NOT NULL DEFAULT 0,
  checked_in     boolean NOT NULL DEFAULT false,
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded','free')),
  amount         numeric(10,2) NOT NULL DEFAULT 0,
  notes          text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS listings (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  seller_id   text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price       numeric(12,2) NOT NULL,
  condition   text NOT NULL,
  category    text NOT NULL,
  status      text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Active','Pending','Sold','Rejected')),
  image       text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  buyer_id    text REFERENCES users(id) ON DELETE SET NULL,
  listed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id           text PRIMARY KEY,
  user_id      text REFERENCES users(id) ON DELETE SET NULL,
  type         text NOT NULL CHECK (type IN ('event','membership','listing')),
  ref_id       text,
  description  text NOT NULL,
  amount       numeric(12,2) NOT NULL,
  currency     text NOT NULL DEFAULT 'EUR',
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','cancelled')),
  provider     text NOT NULL DEFAULT 'manual',
  provider_ref text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  paid_at      timestamptz
);

CREATE TABLE IF NOT EXISTS notifications (
  id         serial PRIMARY KEY,
  user_id    text REFERENCES users(id) ON DELETE CASCADE, -- NULL = everyone
  title      text NOT NULL,
  body       text NOT NULL DEFAULT '',
  link       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id int NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (notification_id, user_id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id         text PRIMARY KEY,
  title      text NOT NULL,
  body       text NOT NULL,
  audience   jsonb NOT NULL DEFAULT '{"type":"all"}',
  channels   jsonb NOT NULL DEFAULT '{"inApp":true,"email":false,"feed":false}',
  recipients int NOT NULL DEFAULT 0,
  sent_by    text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    text REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_type text,
  target_id   text,
  details     jsonb NOT NULL DEFAULT '{}',
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rsvps_event ON rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
