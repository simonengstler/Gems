# Gems decision log

Record decisions that future chats should not accidentally reverse. New entries
go at the top. If a decision changes, add a new entry and mark the old one
superseded rather than rewriting history.

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
