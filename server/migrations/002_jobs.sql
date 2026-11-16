ALTER TABLE users ADD COLUMN IF NOT EXISTS renewal_reminded_for date;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS reminded boolean NOT NULL DEFAULT false;
