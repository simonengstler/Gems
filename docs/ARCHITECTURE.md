# Gems architecture

Last verified: 2026-08-10

## System overview

Gems is a client-heavy Next.js App Router application backed by Supabase.
Vercel serves the web application and server routes. Supabase owns identity,
relational data, realtime change delivery, database authorization, and
administrative APIs used by protected server routes.

```text
Browser
  ├─ Next.js UI and Supabase browser client
  ├─ Supabase Auth and RLS-protected data access
  └─ Service worker and optional Web Push subscription

Vercel
  ├─ Static application shell
  ├─ /api/metadata
  ├─ /api/push/subscribe
  ├─ /api/platform/status
  ├─ /api/cron/rounds
  └─ /api/dev/seed (development requests only)

Supabase
  ├─ Auth
  ├─ PostgreSQL and RLS
  ├─ Realtime
  └─ Service-role operations from protected server routes

External optional services
  ├─ Spotify and YouTube embeds/oEmbed
  ├─ Resend email
  └─ Browser Push via VAPID
```

## Application structure

- `src/app/page.tsx` mounts the main application.
- `src/components/gems-app.tsx` currently contains authentication, circle setup,
  profile, admin, round, rating, reveal, and history UI.
- `src/lib/supabase.ts` creates the public Supabase browser client.
- `src/app/api/metadata/route.ts` retrieves public Spotify/YouTube metadata.
- `src/app/api/push/subscribe/route.ts` stores authenticated device
  subscriptions with a server-side service role.
- `src/app/api/platform/status/route.ts` authenticates a platform allowlist
  member and returns non-secret production readiness and application counters.
- `src/app/api/cron/rounds/route.ts` performs scheduled round and notification
  work and requires `CRON_SECRET` in production.
- `src/app/api/dev/seed/route.ts` creates local dummy data and refuses production
  requests.
- `public/sw.js` receives browser push notifications.

The large UI component is functional but is a known maintainability target. New
work should avoid making it larger when a cohesive feature can be extracted
without broad churn.

## Data model

Core tables:

- `users`: profile nickname, streak, and timestamps; keyed to Supabase Auth.
- `groups`: immutable circle name, rules, creator, and optional archive time.
- `group_members`: role, approval state, approver, and membership timestamps.
- `rounds`: sequential round number and UTC phase boundaries.
- `submissions`: one provider URL per member per round plus optional metadata.
- `ratings`: one reaction per rater per submission with generated points.

Supporting tables:

- `group_settings`: email, push, and automatic-round switches.
- `platform_admins`: explicit allowlist for developer/operator UI.
- `group_invitations`: expiring private invitation tokens.
- `notification_log`: idempotency record for delivered notifications.
- `push_subscriptions`: per-user browser push endpoints and keys.

Database triggers enforce updated timestamps, immutable names, membership
limits, minimum round membership, submission/rating windows, the self-rating
prohibition, default settings, and streak finalization. SQL functions provide
safe membership checks, joining, leaving, invitation handling, limited user
search, and atomic admin-only phase completion after all eligible participation
is present.

All schema changes are forward-only migrations in `supabase/migrations/`.

## Authorization model

Supabase RLS is the primary data boundary:

- Anonymous users have no access to application tables.
- Users can manage their own profile, submission, rating, and push subscription
  only where the corresponding policy permits it.
- Approved membership is required to read circle-owned records.
- Admin membership is required to manage the circle, members, rounds,
  invitations, and settings.
- Helper functions execute membership checks without recursively evaluating the
  same policies.
- Service-role credentials exist only in protected server runtimes.

Frontend visibility is a usability layer, not an authorization layer. Every
privileged action must also be enforced by RLS, a database function, or an
authenticated server route.

Platform operators are provisioned explicitly by an existing database operator,
for example in the Supabase SQL editor:

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'operator@example.com';
```

There is deliberately no browser flow for granting this role.

## Round lifecycle

Round timestamps are stored in UTC:

1. `starts_at` begins submission.
2. `submission_ends_at` uses the circle’s configured 1–14 day choosing interval.
3. `rating_ends_at` uses the configured 1–14 day rating interval.
4. Reveal is derived when the rating deadline has passed.

The browser derives the phase from these timestamps. Starting a new round
finalizes the previous round's streaks. Automatic starts are not continuously
running inside Next.js; they require calls to `/api/cron/rounds`.

`complete_round_phase` locks the active round, verifies circle-admin access,
counts approved members, submissions, and eligible ratings, and advances the
relevant deadline only when the whole phase is complete. If choosing ends
early, it preserves the round's stored rating duration by moving
`rating_ends_at` forward with the new phase start.

Time Machine preserves the round’s configured relationship by shifting all
three timestamps backward together. It is an admin-only production capability
and requires user confirmation.

## Notifications

The cron route:

- uses a service-role Supabase client;
- starts a round only for circles with `auto_start_rounds` enabled;
- evaluates round-start, rating-start, and 12-hour warning windows;
- respects circle email and push switches;
- checks `notification_log` before delivery;
- records only delivered notifications;
- treats missing Resend configuration as a dry run.

`vercel.json` schedules this route once each day at 12:00 UTC. Vercel Hobby
may invoke it within that hour, so candidate notifications remain eligible for
their whole choosing/rating interval and the final 24 hours before rating ends.
The notification log keeps each recipient/event pair idempotent.

The platform-status route exposes no credentials. It requires both an
authenticated Supabase token and a `platform_admins` allowlist row. Its Resend
remaining counts are derived from successful email rows in `notification_log`;
they are an application-side guardrail rather than the provider's billing
meter.

The free schedule is deliberately daily. More frequent or minute-precise
notifications require a paid Vercel plan or an explicitly approved external
scheduler.

## Environment variables

Public browser values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

Server-only secrets:

- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PRIVATE_KEY`
- `CRON_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

`.env.local` is for local development and must never be used as the source of
production Supabase values. Production must point at the cloud project, never
`127.0.0.1:54321`.

## Deployment

The exact release and verification sequence lives in
[`docs/OPERATIONS.md`](OPERATIONS.md). It is mandatory reading before a
production deployment.

Primary production URL:

`https://gems-music.com`

Primary production host: Vercel Hobby.

`gems-music.com` is registered with Vercel, uses Vercel DNS, and is assigned to
the `gems` project. The legacy `gems-rosy.vercel.app` alias remains available.
Supabase Auth's site URL and redirect allowlist include the primary domain,
`www`, the legacy alias, and local development URLs. Database migrations are
pushed independently with the Supabase CLI.

The Vercel account is not connected to the GitHub identity. Vercel may block a
normal CLI source deployment when it tries to match Git commit authors. The
known working path is a locally built, Vercel Production-configured prebuilt
artifact staged outside Git and deployed with `vercel deploy --prebuilt --prod`.
This prevents an author-identity failure and prevents `.env.local` from leaking
into production. The runbook includes the required traced-runtime staging and
post-deployment verification.

Do not document or commit secret values.

## Current operational gaps

- No automated unit, integration, or end-to-end test suite.
- No checked-in production cron schedule.
- Resend delivery requires a verified sender domain and production environment
  values before email notifications can send to arbitrary recipients.
- Provider limits remain reference text; application usage and Resend delivery
  counts are live.
- Most product UI remains concentrated in one large client component.
