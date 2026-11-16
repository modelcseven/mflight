# MFlight — BMW Car Club Europe members platform

Members-only club site: feed, virtual garage, events with RSVP/waitlist/payments, global member map,
member marketplace (Part Store), account settings, and a role-based admin dashboard.

- **app/** — React 19 + TypeScript + Vite + Tailwind front end
- **server/** — Node 22 + Express API, PostgreSQL, serves the built front end
- **Dockerfile / docker-compose.yml** — one container for the site + a Postgres container

## Features

**Members:** email sign-up/sign-in, optional Google/Facebook sign-in, password reset, email confirmation,
two-step verification (authenticator app), club feed (posts, photos, likes, comments, reporting), virtual garage
(add/edit cars, photo uploads, AI insights), events (RSVP with guests/cars, automatic waitlist, card payment),
Part Store (sell, buy/request, mark sold), profile, account settings (email, password, 2FA, notifications,
privacy, connected accounts, membership renewal & payment history, delete account), notifications.

**Admin (`/admin`)** — areas shown per role:

| Role | Areas |
|---|---|
| Super Admin | Everything, including sign-in, email, payments and AI integrations |
| Admin | Everything except integration secrets; cannot change other admins |
| Chapter Lead | Overview, Members and Events for their own country, chapter announcements |
| Moderator | Overview, Moderation, Garages, Marketplace |

Sections: Overview (stats, 12-month charts, action queue), Members (approve, suspend, roles, tiers, chapters,
invites, password reset, CSV), Events (create/edit, publish, feature, cancel, capacity, attendees with check-in,
payment status, waitlist promotion, messaging, CSV), Moderation (reports queue, hide/pin/delete posts & comments),
Garages (Car of the Month, hide), Marketplace (approve/reject), Orders & payments (mark paid, refund via Stripe,
CSV), Announcements (in-app/email/pinned post to all, tier, chapter or role), Audit log, Settings (branding &
colours, tiers, membership rules, event & marketplace rules, chapters/map data, sign-in options, SMTP, Stripe, AI).

Background jobs (every 6 h): renewal reminders, optional auto-suspend after the grace period, event reminders 3 days out.

## Run locally

```bash
# Postgres running somewhere, then:
cd server && npm install
DATABASE_URL=postgres://postgres@localhost:5432/mflight JWT_SECRET=dev \
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=ChangeMe123 STATIC_DIR=../app/dist npm start

cd app && npm install && npm run dev     # http://localhost:5173 (proxies /api to :3000)
```

The first start creates the schema, seeds the club data and creates the super admin from `ADMIN_EMAIL` /
`ADMIN_PASSWORD` (if no password is set, a random one is printed in the log).

## Deploy (Coolify / any Docker host)

**Option A — Docker Compose resource (app + database together):** point Coolify at this repo, choose
*Docker Compose*, set the variables from `.env.example`, attach your domain to the `app` service on port 3000.

**Option B — Dockerfile + separate Coolify PostgreSQL:** create a PostgreSQL resource, then an application from
this repo using the *Dockerfile* build pack, port 3000, persistent storage mounted at `/data/uploads`, and env:
`APP_URL`, `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `NODE_ENV=production`.

Health check: `GET /api/health`. Sessions use secure cookies in production, so serve over HTTPS.

## After first sign-in

1. Admin → Settings → **Email** — add SMTP so invites, resets and announcements are emailed.
2. Settings → **Payments** — add Stripe keys; add the webhook URL shown there in the Stripe dashboard.
3. Settings → **Sign-in** — optional Google/Facebook keys (redirect URIs are shown on the page).
4. Settings → **AI** — any OpenAI-compatible endpoint for Garage AI insights.
5. Settings → **Club & branding** — name, colours, logo.

## Re-generating seed data

`node server/scripts/gen-seed.mjs` rebuilds `server/seed.json` from `server/scripts/seed-source.ts`
(requires `app/node_modules`). Seed data is only loaded into an empty database.
