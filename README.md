# Bloom

**A calm, shared baby tracker for the whole family.**

Bloom records feeding, diapers, sleep, growth, health, activities and milestones for multiple babies, shares them with invited parents and caregivers in real time, and turns the real records into charts and printable PDF reports. It runs on this VPS with PostgreSQL — no external SaaS account required.

> Status: production build deployed on the VPS at `https://baby.141.145.192.23.nip.io`. The existing `wassl/` delivery demo and `calculator.py` are untouched.

---

## What's included

| Area | Details |
|---|---|
| Auth | Email + password, secure httpOnly sessions, verification, password reset, rate limiting, per-session revocation |
| Families | Owner / parent / caregiver / read-only roles, invitations by email, secure link or short code, revoke, remove, change role |
| Babies | Multiple babies per family, full birth profile, photo upload, automatic age (months / weeks / days) |
| Feeding | Live breastfeeding timer with side switching and persistence, formula quick volumes, expressed milk, combined feeds, history and stats |
| Diapers | Wet / dirty / mixed / dry, urine and stool details, one-tap logging, daily and weekly stats |
| Sleep | Nap and night sessions, live ongoing session stored server-side, quality and notes, interruptions field |
| Growth | Weight, height and head circumference with WHO percentile bands (LMS data) and measured/estimated labels |
| Health | Medications, doses given, temperature, vaccinations, appointments, symptoms |
| Activities | Bath, tummy time, play, walks, vitamins, pumping, solids, custom activities, milestones with photos |
| Timeline & history | Day / week / month, calendar, search, filters, edit and delete with attribution |
| Insights | Daily / weekly / monthly / custom ranges, period comparison, real SQL aggregates in the family timezone |
| PDF reports | Any date range and section selection; cover, feeding, diaper, sleep, growth/health, final timeline; page numbers, charts, brand typography |
| Reminders | Interval or daily schedules, quiet hours, in-app inbox, duplicate prevention, Web Push |
| Offline | Service worker app shell, IndexedDB outbox, automatic replay, cached reads, sync endpoints with versions |
| i18n | English, French, Spanish and Arabic with full RTL layout and localized PDFs |
| Security | PostgreSQL Row Level Security on every family table, server-side permission checks, audit log, private uploads |
| Export | Full JSON and timeline CSV |
| PWA | Installable, offline fallback, web push |

---

## Stack

- Next.js 16 (App Router), React 19, TypeScript strict
- Tailwind CSS v4 with a custom warm design system
- PostgreSQL 13+ (tested on 13.23), `pg`, Row Level Security
- TanStack Query, Dexie (IndexedDB), Recharts, `@react-pdf/renderer`, `web-push`, Nodemailer, Zod
- Systemd + Caddy on the VPS

The previous project used a JSON store; Bloom deliberately uses PostgreSQL because family sharing, RLS, concurrent writes, realtime and reporting need a real database. The existing demo is preserved separately.

---

## Repository layout

```
bloom/
├─ db/schema.sql              # tables, constraints, indexes, functions, triggers, RLS, grants
├─ src/app/                   # pages and API routes
│  ├─ (auth)/                 # login, signup, reset, verify, join with code
│  ├─ (app)/                  # dashboard, trackers, timeline, insights, reports, family, settings
│  └─ api/                    # auth, families, records, sync, realtime, analytics, reports, export, push
├─ src/components/            # design system, shell, timeline, providers
├─ src/hooks/                 # query/mutation/offline/realtime hooks
├─ src/i18n/                  # flat dictionaries (en, fr, es, ar)
├─ src/lib/                   # db, auth, RLS access, validation, WHO LMS, PDF
├─ assets/fonts/              # embedded PDF fonts (Manrope, Fraunces)
├─ worker/reminders.mjs       # reminder/notification worker
├─ scripts/                   # migration + backups
├─ deploy/                    # systemd units and Caddy block
└─ tests/                     # unit, RLS integration, Playwright
```

---

## 1. Local installation

Requirements: Node 22+, npm 10+, PostgreSQL 13+.

```bash
cd bloom
npm install
cp .env.example .env.local    # then edit values
```

### Database

Create a restricted application role (not the owner), a bypass-RLS worker role, and the database:

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE bloom_app LOGIN PASSWORD 'choose-a-strong-password';
CREATE ROLE bloom_worker LOGIN PASSWORD 'another-strong-password' BYPASSRLS;
CREATE DATABASE bloom OWNER postgres;
GRANT CONNECT ON DATABASE bloom TO bloom_app;
SQL
```

Apply the schema:

```bash
sudo -u postgres psql -d bloom -v ON_ERROR_STOP=1 < db/schema.sql
```

Or, with an administrative connection string:

```bash
DATABASE_ADMIN_URL='postgres://postgres@/bloom?host=/var/run/postgresql' npm run db:migrate
```

Grant object privileges to the worker (the schema grants the web role automatically; run this after migrations):

```bash
sudo -u postgres psql -d bloom -c \
  "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bloom_worker;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bloom_worker;"
```

The app connects with `bloom_app`; migrations and the worker use elevated connections. RLS is enabled on every family-scoped table and reads `app.user_id`, which is set per request inside a transaction (`src/lib/db.ts`).

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | `postgres://bloom_app:…@127.0.0.1:5432/bloom` — restricted role |
| `WORKER_DATABASE_URL` | worker | `bloom_worker` connection with `BYPASSRLS` for reminders |
| `DATABASE_ADMIN_URL` | migrations | administrative connection for `npm run db:migrate` |
| `AUTH_SECRET` | yes | 32 random bytes (sessions + tokens) |
| `APP_URL` | yes | public origin, e.g. `https://baby.example.com`; also enables secure cookies over HTTPS |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | optional | real verification, reset and invitation email. Without SMTP, links are written to `outbox/` and logged in development |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | optional | Web Push. Generate with `npx web-push generate-vapid-keys --json` |
| `UPLOAD_DIR` | optional | private upload directory, default `./uploads` |

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Run

```bash
npm run dev        # http://localhost:3001
npm run build
npm start          # production, port 3001
node worker/reminders.mjs   # reminders (separate process)
```

First visit: create an account → create a family and baby → log anything.

---

## 2. Security model

- The browser never receives database credentials; all writes go through authenticated route handlers.
- Every request opens a transaction and runs `select set_config('app.user_id', $1, true)` before touching data.
- RLS policies on `families`, `babies`, every tracker table, reminders, attachments and audit logs require active membership. Role checks are in the database too:
  - **owner** — all family data, members, invitations, delete family
  - **parent** — all baby data, invites, reminders
  - **caregiver** — create records and edit/delete only their own entries
  - **viewer** — read-only
- Invitations store only a SHA-256 token hash, are single-use and expire in 7 days; acceptance is a `SECURITY DEFINER` function that validates the invited email.
- Uploads are stored outside `public/` and served through an authorization-checked route.
- `npm run test:rls` proves an unrelated account sees zero rows and cannot insert into another family.
- In production, `npm run build` does not include service secrets in client bundles; only `NEXT_PUBLIC_` variables would, and none are used for secrets.

### What is *not* configured by default

- **Social login** was intentionally omitted per product decision. Email/password only.
- **Email delivery** requires SMTP. In development, verification/reset links are saved to `outbox/` and returned as a dev link. In production without SMTP, the API says email delivery is unavailable rather than pretending.
- **Web Push** requires VAPID keys. Without them, in-app notifications still work.
- **iOS push** requires iOS 16.4+, HTTPS and installing the PWA.

---

## 3. Deploy on this VPS

The live deployment uses:

- PostgreSQL on `127.0.0.1:5432` (`bloom` database, `bloom_app` + `bloom_worker` roles)
- Next.js on `127.0.0.1:3001` via systemd (`bloom-web`)
- reminder worker via systemd (`bloom-worker`)
- Caddy TLS for `baby.141.145.192.23.nip.io`

```bash
# install dependencies and build
npm ci
npm run build

# install services
sudo cp deploy/bloom-web.service deploy/bloom-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bloom-web bloom-worker
sudo systemctl status bloom-web --no-pager

# Caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile   # review existing blocks first
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Secrets live in `/etc/bloom/bloom.env` (mode `0600`). The repository's `.env.local` is only for local development and is gitignored.

Backups:

```bash
sudo install -m 700 scripts/backup.sh /usr/local/bin/bloom-backup
sudo /usr/local/bin/bloom-backup
```

The script writes a compressed `pg_dump` and an uploads archive under `/var/backups/bloom` and keeps 14 daily copies. Add it to cron:

```cron
15 3 * * * /usr/local/bin/bloom-backup
```

Restore:

```bash
sudo -u postgres pg_restore --clean --if-exists -d bloom /var/backups/bloom/bloom-YYYY-MM-DD.dump
sudo tar -xzf /var/backups/bloom/uploads-YYYY-MM-DD.tar.gz -C /
```

---

## 4. Reports

Reports are generated on the server with `@react-pdf/renderer` from the selected records only:

1. Cover — baby, photo, DOB, age during the period, period, generated date, summary, contributors
2. Feeding — totals, daily chart, every feeding row
3. Diapers — wet/dirty/mixed/dry totals, daily chart, every row
4. Sleep — totals, naps, daily hours, every session
5. Growth + health — measurements table, medication/temperature, vaccines/appointments
6. Final — activities, milestones, parent notes, contributors, page numbers

Presets: today, yesterday, last 7, last 30, this month, previous month, custom. Sections are individually selectable. Fonts and charts are embedded; the PDF can be downloaded, shared via the Web Share API, or printed. Arabic reports use the localized strings supplied by the request locale.

---

## 5. Offline and sync

- Service worker caches the app shell and serves `/offline` when there is no network.
- TanStack Query caches are mirrored in IndexedDB and used when a request fails offline.
- Creates/updates/deletes that fail offline go into a Dexie outbox and are replayed automatically on `online` and every 30 seconds.
- The server exposes `/api/sync/pull?since=…` (delta rows including tombstones) and `/api/sync/push` (batch apply with per-record version conflict handling).
- Client-generated UUIDs make replay idempotent; separate offline-created records are both kept.
- The header shows “Waiting to sync” with a count until the queue is empty.

---

## 6. Mobile and iPhone

Bloom is built as an installable PWA and tuned to feel like a native app on a phone:

- The viewport is locked (`user-scalable=no`, `maximum-scale=1`) and pinch/double-tap zoom is disabled in CSS, so the screen cannot be zoomed.
- Horizontal scrolling is prevented at `html`, `body`, `.app-shell` and page level (`overflow-x: clip`, `overscroll-behavior-x: none`, `touch-action: pan-y`).
- Inputs use a 16px font so iOS Safari never zooms the page when a field is focused.
- Safe-area insets are respected for the top bar and bottom tab bar on notched iPhones.
- The layout is checked in the Playwright suite to have no horizontal overflow at 390×844.

### Feeding reminders

Every new family automatically gets a **feeding reminder every 3 hours** that both parents and caregivers share:

- The reminder's next due time is recalculated after every feed that any member logs, so the notification always follows the last feed.
- The worker creates an in-app notification for **every active family member** (owner, parent, caregiver, read-only) and sends Web Push to each phone that has enabled notifications.
- Duplicate notifications are prevented per member and per reminder slot, even with several parents.

### Enabling push on iPhone (required once per phone)

1. Open the site in Safari and tap **Share → Add to Home Screen**.
2. Open Bloom from the new Home Screen icon (it runs standalone).
3. On the dashboard, tap **Enable notifications** in the *Feeding reminders* card (or Settings → Notifications).
4. Allow notifications when iOS asks.

Each caregiver repeats this on their own phone. iOS 16.4+ is required for Web Push. If notifications are blocked, the in-app notification bell still shows every reminder.

Feeding input is deliberately short: choose the type, tap a quantity chip (30–240 ml) or type one amount, then Save. Brand, water, powder, bottle, storage and notes live under **Details** and are optional.

## 7. Tests

```bash
npm test              # Vitest unit + RLS integration
npm run test:e2e      # Playwright (requires the app on :3001)
```

Covered:

- age and timezone maths, durations, date formatting
- WHO LMS percentile calculations and chart bands
- translation key parity and placeholder preservation
- Zod validation for every tracker payload
- PostgreSQL RLS: outsider cannot select, insert, update or delete another family's records; caregiver ownership rules
- Playwright: signup, onboarding, logging a feed, timeline visibility, locked viewport and no horizontal overflow, real PDF generation/download, realtime updates between two parents in separate browsers, offline queue replay

---

## 8. Data model (high level)

`users`, `sessions`, `email_tokens`, `profiles`, `families`, `family_members`, `family_invitations`, `babies`, `feeding_sessions`, `diaper_entries`, `sleep_sessions`, `growth_measurements`, `medications`, `medication_logs`, `temperature_records`, `vaccinations`, `appointments`, `symptoms`, `activities`, `milestones`, `baby_notes`, `reminders`, `notifications`, `push_subscriptions`, `attachments`, `audit_logs`.

All tracker tables share `family_id`, `baby_id`, `recorded_by`, `created_at`, `updated_at`, `deleted_at`, `version`. Indexes cover baby + time. Soft deletes preserve history for sync; physical deletes cascade only for account/baby deletion.

Realtime is implemented with `pg_notify` triggers → one LISTEN connection → authenticated SSE filtered by family membership.

---

## 9. Product decisions and honest limitations

- **No social login** — per explicit request; email/password only.
- **No medical advice** — percentiles are informational, medication doses are never suggested.
- **Email delivery** depends on SMTP; the UI exposes that state instead of faking success.
- **Web Push** requires VAPID keys and HTTPS; in-app notifications always work.
- **Imperial units** are used for display and export labels; storage remains metric (`g`, `cm`, `ml`) so data never loses precision.
- The app is a single-VPS deployment. For horizontal scale, move the SSE bus to Redis/Postgres LISTEN per instance and the worker to a single elected instance.
- The previous `wassl/` application remains independent on port 3000; Bloom runs on 3001 behind its own Caddy host.

---

## 10. License / ownership

Private family application built for this project. Fonts: Manrope and Fraunces (SIL Open Font License). WHO growth standards data: public WHO Child Growth Standards LMS tables.
