# Gems architecture

Last verified: 2026-09-02

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
- `src/app/api/submissions/route.ts` authenticates and enriches song
  submissions before writing them with the server-only Supabase credential.
- `src/app/api/push/subscribe/route.ts` stores authenticated device
  subscriptions with a server-side service role.
- `src/app/api/platform/status/route.ts` authenticates a platform allowlist
  member and returns non-secret production readiness and application counters.
- `src/app/api/cron/rounds/route.ts` performs scheduled round and notification
  work and requires `CRON_SECRET` in production.
- `src/app/api/dev/seed/route.ts` creates local dummy data and refuses production
  requests.
- `public/sw.js` receives browser push notifications.

The runtime uses Next.js 16.4.0. Sensitive Vercel Production variables remain
server runtime configuration; prebuilt compilation needs only public values.
Sensitive-value placeholders returned by the CLI are omitted from the local
build cache, and no local secret is substituted. Package lifecycle scripts
are disabled during release dependency installation. The repository no longer carries the unused
Vite, Vinext, Cloudflare, Wrangler, or Shadcn CLI packages; the existing Radix
components and Tailwind styling remain. The lockfile includes reviewed
compatible security updates. Development is paused, so dependency checks must
be repeated before a future release.

The large UI component is functional but is a known maintainability target. New
work should avoid making it larger when a cohesive feature can be extracted
without broad churn.

## Data model

Core tables:

- `users`: profile nickname and timestamps; keyed to Supabase Auth.
- `groups`: immutable circle name, rules, creator, and optional archive time.
- `group_members`: role, approval state, approver, and membership timestamps.
- `rounds`: sequential round number and UTC phase boundaries.
- `submissions`: one provider URL per member per round plus display metadata and
  a server-derived provider/recording identity.
- `ratings`: one reaction per rater per submission with generated points.

Supporting tables:

- `group_settings`: email, push, and automatic-round switches.
- `platform_admins`: explicit allowlist for developer/operator UI.
- `group_invitations`: expiring private invitation tokens with a bounded,
  idempotent redemption count.
- `notification_log`: idempotency record for delivered notifications.
- `push_subscriptions`: per-user browser push endpoints and keys.

Database triggers enforce updated timestamps, immutable names, membership
limits, minimum round membership, submission/rating windows, the self-rating
prohibition and default settings. SQL functions provide
safe membership checks, joining, leaving, invitation handling, limited user
search, and atomic admin-only phase completion after all eligible participation
is present.

Invitation redemption locks the invitation row before checking membership and
capacity. An account that is already pending or approved returns the existing
request without incrementing the invitation's use count, including when two
browser requests arrive concurrently. A new request or a rejected account's
new request consumes one use.

Song submission writes are server-mediated. The server validates the session
and approved membership, accepts only canonical Spotify or YouTube hosts,
retrieves free public oEmbed/page metadata, and derives normalized artist,
title, and version fields. PostgreSQL takes a Circle-scoped transaction lock
and rejects a matching provider item or high-confidence semantic recording
match from a lower-numbered round. The comparison deliberately ignores
presentation labels such as “Official Video” while retaining remix, live,
cover, acoustic, edit, and similar version qualifiers. Same-round matches are
excluded from the lookup so hidden coincidental choices remain private and are
both accepted. Older rows are enriched lazily when their stored title makes
them a plausible match.

Authenticated browsers retain RLS-protected read/delete access to submissions
but cannot insert or update them directly. Server-mediated writes and the
database trigger are both required: the route supplies trusted metadata, while
the trigger provides atomic cross-client enforcement.

All schema changes are forward-only migrations in `supabase/migrations/`.

## Authorization model

Supabase RLS is the primary data boundary:

- Anonymous users have no access to application tables.
- Users can manage their own profile, rating, and push subscription only where
  the corresponding policy permits it. Submission creation/replacement goes
  through the authenticated server route; users may still delete their own
  submission during choosing under RLS.
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

The browser derives the phase from these timestamps. Automatic starts are not
continuously running inside Next.js; they require calls to `/api/cron/rounds`.

The Circle navigation loads each accessible Circle's latest round, approved
members, current submissions, and eligible ratings to show compact phase and
progress summaries. Active phases also derive a localized remaining-time
countdown from their stored UTC deadline. The selected Circle ID is stored under
a user-scoped browser key and restored only if it remains in the current
accessible set.

`complete_round_phase` locks the active round, verifies circle-admin access,
counts approved members, submissions, and eligible ratings, and advances the
relevant deadline only when the whole phase is complete. If choosing ends
early, it preserves the round's stored rating duration by moving
`rating_ends_at` forward with the new phase start.

Time Machine preserves the round’s configured relationship by shifting all
three timestamps backward together. It also provides an admin-only confirmed
shortcut to the exact next phase: choosing moves `submission_ends_at` to now
and preserves the stored rating duration; rating moves `rating_ends_at` to now.

## Notifications

The protected `POST /api/notifications/round-event` route verifies the
requesting approved circle admin and a newly created round or phase transition,
then sends the enabled round-start, rating-start, or results-ready email
immediately. Both normal phase-completion actions and exact Time Machine phase
shortcuts call this route. A Time Machine day shift that crosses a phase calls
the same route with its explicit admin-only context. Other calls retain a
five-minute event window, preventing an old phase from becoming a delayed
catch-up broadcast. Runtime logs record only event type and aggregate delivery
counts, never recipient addresses.

All notification emails put `Gems · {Circle name}` in the subject and repeat
the Circle name in the HTML body. The user-visible email categories are an
on-demand admin test, new-round, choosing-reminder, songs-ready,
rating-reminder, and results-ready email. Reminder bodies are bilingual because
Gems does not yet persist a per-user language preference. The delivery log
makes each event idempotent per recipient and round.

The cron route:

- uses a service-role Supabase client;
- starts a round only for circles with `auto_start_rounds` enabled;
- sends an automatic round-start immediately after creating that round, and
  evaluates first-day rating and results-ready fallbacks;
- sends one final-48-hours email only to members who still need to submit or
  finish eligible ratings, and skips a separate reminder for phases of two days
  or less;
- respects circle email and push switches;
- checks `notification_log` before delivery;
- records only delivered notifications;
- treats missing Resend configuration as a dry run.

`vercel.json` schedules this route once each day at 12:00 UTC. Vercel Hobby
may invoke it within that hour. Immediate manual events are not dependent on
that schedule; daily phase fallbacks are limited to their first 24 hours and
reminders to the final 48 hours, so old phases are never sent as a backlog. The
notification log keeps each recipient/event pair idempotent.

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
