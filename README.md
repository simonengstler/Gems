# Gems

Gems is a private music-discovery ritual for groups of 2–8 people. Each circle
chooses the duration of its choosing and rating intervals.
Members submit one Spotify or YouTube link, listen and react during the rating
phase, then keep the leaderboard and reactions in a permanent round archive.

Production: [https://gems-music.com](https://gems-music.com)

## Project documentation

- [`APP_RULES.md`](APP_RULES.md) — canonical product behavior and invariants.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system, data, security, and
  deployment boundaries.
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — local setup, migrations,
  production release, verification, rollback, and operator access.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — shipped capabilities and prioritized
  gaps.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — consequential product and technical
  decisions.
- [`AGENTS.md`](AGENTS.md) — durable working instructions for Codex and other
  coding agents.

## Local development

Requirements: Node.js 20.9+, Docker Desktop, and npm.

```bash
npx supabase@latest start
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Supabase Studio is
available at [http://127.0.0.1:54323](http://127.0.0.1:54323).

Copy `.env.example` to `.env.local` when configuring a new environment. Local
Supabase credentials come from:

```bash
npx supabase@latest status
```

## Safety defaults

- Resend email delivery is off for every new circle.
- No email can be sent unless both `RESEND_API_KEY` is configured and a circle
  admin enables its master email switch.
- Browser push is opt-in per user and per circle.
- Spotify and YouTube metadata uses public oEmbed endpoints by default, avoiding
  paid API quotas.
- Time Machine is available only to circle admins and asks for confirmation
  before changing the shared round deadlines.
- Dummy-data tools are excluded from production behavior.

## Scheduled rounds and notifications

Call `GET /api/cron/rounds` on a regular schedule. In production, provide
`Authorization: Bearer $CRON_SECRET`. The endpoint:

- starts new rounds for circles that enabled automation;
- sends idempotent round-started, rating-started, and streak-warning messages;
- respects every circle’s email and push switches;
- performs dry runs when Resend is not configured.

For production email, verify a sending domain in Resend, create a restricted
API key, and add `RESEND_API_KEY` plus a sender such as
`Gems <updates@your-verified-domain.example>` in `RESEND_FROM_EMAIL` to the
Vercel Production environment. Redeploy after changing environment values.
Every circle still starts with email disabled.

Vercel Hobby runs the notification route once daily. Enable a circle’s master
email switch to send the admin a test message, then use the **Send test email
to me** action in Circle Admin to verify delivery. Phase emails are delivered
during their active interval rather than at an exact minute on the free plan.

Allowlisted platform operators can open the gear icon in the top-right user
menu. The developer console shows whether the two Resend values are present,
remaining free-tier email allowances calculated from the Gems delivery log,
and current application row counts. It never returns secret values.

## Validation

```bash
npm run lint
npm run build
```

There is not yet a dedicated automated test suite. Until one is added, lint,
the production build, migration review, and focused live verification are the
minimum release checks.
