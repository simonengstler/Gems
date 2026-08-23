# Gems decision log

Record decisions that future chats should not accidentally reverse. New entries
go at the top. If a decision changes, add a new entry and mark the old one
superseded rather than rewriting history.

## 2026-08-23 — Invitation uses count membership requests, not page loads

**Status:** Accepted

Redeeming an invitation is idempotent for an account that is already pending or
approved in the Circle. Reopening a link, an authentication event firing twice,
or concurrent browser requests must return the existing membership request
without consuming additional uses. A new request, including a rejected
account requesting approval again, consumes one use. PostgreSQL serializes
redemptions on the invitation row so this guarantee holds across clients.

## 2026-08-22 — Recording identity prevents repeats without exposing same-round choices

**Status:** Accepted

Gems rejects a recording that already appeared in an earlier round of the same
Circle. Spotify and YouTube submissions use free public provider metadata plus
conservative local normalization; no paid matching or AI service is required.
Provider presentation text is ignored, while remix, live, cover, acoustic,
edit, and similar version labels remain part of the recording identity so those
versions stay eligible. Matches within one round are intentionally allowed
because private members may choose the same recording coincidentally; neither
submission may reveal or block the other. Submission writes are server-mediated
and the final prior-round check is atomic in PostgreSQL.

## 2026-08-17 — Phase reminders use the final day

**Status:** Accepted

Choosing and rating intervals longer than one day receive one reminder during
their final 24 hours. Only members who still need to submit or complete eligible
ratings are emailed. One day is preferred over two because Circle admins may
configure phases as short as one day; one-day phases rely on their opening email
instead of sending two messages at the same boundary. The free daily scheduler
does not guarantee an exact delivery hour.

## 2026-08-11 — Time Machine phase changes are real notification events

**Status:** Accepted

All Time Machine controls use the same immediate notification path as normal
admin phase completion when they cross into listening or results. Notification
failures are shown to the admin after the shared deadline changes instead of
being silently hidden.

## 2026-08-11 — Results matter; streaks do not

**Status:** Accepted

The streak feature, its stored profile value, round-start trigger, search
output, and warning email are removed. A results-ready email replaces the
warning: it is immediate when an admin reveals results and has a first-day
daily fallback for deadline-based completion.

## 2026-08-11 — Email identity and phase-boundary testing are explicit

**Status:** Accepted

Every Gems email identifies its Circle in the subject and body, so members can
distinguish notifications from multiple circles. Circle-admin Time Machine
controls include confirmed shortcuts to the exact next phase; skipping choosing
preserves the stored rating duration, while skipping rating reveals results.

## 2026-08-10 — Manual round events deliver immediately without a backlog

**Status:** Accepted; supersedes the phase-delivery portion of the daily-check decision below and superseded in part by the results-ready decision above

When an approved circle admin starts a round or finishes choosing early, a
protected server route sends the enabled email event immediately and records
each successful recipient delivery. The route accepts only a newly started
phase, so enabling email later cannot turn historical active phases into a
catch-up broadcast. Vercel's daily Cron remains for automatic round starts and
the first-day deadline fallback.

## 2026-08-10 — Free-tier email notifications use a daily scheduled check

**Status:** Superseded in part by the immediate manual-event decision above

Vercel Cron calls the protected notification route once daily at 12:00 UTC.
Event eligibility spans the relevant round phase, and notification-log
idempotency ensures each eligible recipient receives each event only once.
This keeps the feature within Vercel Hobby limits; it does not promise
minute-precise delivery. Enabling a circle's email master switch sends the
enabling admin a test email when Resend is configured, so sender configuration
problems are visible immediately.

## 2026-08-10 — Repository documentation is the operational handoff

**Status:** Accepted

Fresh chats must use `AGENTS.md` and `docs/OPERATIONS.md` as the canonical
handoff for local setup, forward-only migrations, Vercel prebuilt production
release, live verification, rollback, and operator access. Vercel is the only
supported deployment target; the older private Sites wiring was removed to
avoid conflicting deployment instructions.

## 2026-08-01 — gems-music.com is the canonical production domain

**Status:** Accepted; supersedes `gems-rosy.vercel.app` as the primary URL

The application, authentication redirects, and notification links use
`https://gems-music.com`. Vercel owns registration and DNS for the domain. The
old `vercel.app` address remains a working fallback alias.

## 2026-07-30 — Reactions require an eligible listener

**Status:** Accepted

Members never rate their own submissions. The database enforces this invariant,
the listening interface unlocks reactions only after the song is opened, and
progress counts all eligible member/submission pairs rather than multiplying
members by every submission indiscriminately.

## 2026-07-30 — Early completion preserves the next interval

**Status:** Accepted

Ending choosing early starts rating immediately but retains the full rating
duration stored on that round. Completing a phase must not silently consume
time allocated to the next phase or later rounds.

## 2026-07-30 — Operator usage is protected and non-secret

**Status:** Accepted

The allowlisted platform console may use a service-role server route to report
non-secret application counters and delivery-log-based free-tier guardrails.
It never exposes credentials and must clearly distinguish application counters
from provider billing meters.

## 2026-07-28 — Round intervals are configurable

**Status:** Accepted; supersedes the fixed five-day/seven-day duration

Circle admins may configure separate 1–14 day choosing and rating intervals for
future rounds. Current rounds retain their stored deadlines. User-facing
introductory copy describes the cycle abstractly and uses countdowns in active
rounds.

## 2026-07-28 — Platform operations are separate from circle administration

**Status:** Accepted

Service limits and future operator tooling belong to an explicit,
RLS-protected platform-admin allowlist. Creating or administering a circle does
not grant platform access.

## 2026-07-28 — Repository files are the cross-chat source of truth

**Status:** Accepted

Future chats must rely on `AGENTS.md`, `APP_RULES.md`, the documents in `docs/`,
the current working tree, migrations, and Git history. Chat memory is helpful
but is not authoritative. Product, architecture, roadmap, and decision files are
updated in the same commit as material behavior changes.

## 2026-07-26 — Vercel is the primary public host

**Status:** Accepted; superseded in part by the custom-domain decision above

The production application is hosted at `https://gems-rosy.vercel.app` so it is
independent of an OpenAI account session. Supabase remains the backend. Hosting
must stay on free tiers until the user explicitly approves otherwise.

Because the Vercel account is not connected to the GitHub identity, verified
prebuilt deployments staged without Git metadata are the current reliable
deployment method.

## 2026-07-26 — Time Machine is an admin production capability

**Status:** Accepted; supersedes the original development-only rule

Circle admins may use Time Machine in production because it is valuable for
testing and operating the round lifecycle. It must remain admin-only, preserve
round duration constraints, and request confirmation before changing shared
deadlines. Dummy-data creation remains development-only.

## 2026-07-26 — Notifications are cost-safe and opt-in

**Status:** Accepted

Email notifications default to off, require a circle master switch, and send
nothing when Resend is not configured. Browser push requires user/device
permission and a circle-level switch. Notification events are idempotent.

## 2026-07-26 — Supabase RLS is the primary authorization boundary

**Status:** Accepted

Circle privacy and roles are enforced in PostgreSQL policies, constraints,
triggers, and narrowly scoped functions. UI visibility alone is never accepted
as authorization. Service-role credentials are restricted to protected server
routes.

## 2026-07-26 — Rounds use UTC timestamps and countdowns

**Status:** Accepted

The database stores UTC timestamps. The frontend displays relative countdowns
instead of asking members to interpret a shared timezone.

**Superseded in part:** interval lengths became configurable on 2026-07-28.

## 2026-07-26 — Names are immutable

**Status:** Accepted

Nicknames and circle names are globally unique and immutable. This favors stable
identity and history over rename flexibility.
