# Gems roadmap

Last updated: 2026-08-10

This is the shared status board for future chats. Move work between sections as
its status changes; do not duplicate the same item in multiple sections.

## Shipped

- Email/password signup, confirmation, sign-in, reset, and password change.
- Unique immutable nicknames and circle names.
- Circle creation, exact-name join requests, approval, removal, leaving, and
  archiving.
- Expiring private invitation links.
- Multiple-circle switching.
- Configurable submit/rate intervals, reveal, and persistent history flow.
- Spotify and YouTube parsing, embedded playback, metadata, and original links.
- Private saved-song confirmation for uploaders throughout the choosing phase.
- Five reactions with generated point values and per-user rating updates.
- Profile totals, reactions received, nickname search, and full listener
  profile drill-down within existing access.
- Circle admin view with rules, lifecycle, invitations, notification controls,
  interval settings, and member management.
- Admin-only early phase completion after all submissions or ratings are done.
- Early choosing completion preserves the full configured rating interval.
- Ratings exclude each member's own submission, require opening the song first,
  and show circle-wide eligible progress.
- Separate allowlisted platform-operator view for service-limit references,
  production readiness, and live application usage counters.
- Mobile new-circle access and balanced circle-lifecycle action buttons.
- One-glance product home page linked from the Gems brand.
- Browser push subscription and idempotent notification delivery logic.
- Cost-safe email controls and dry-run behavior when Resend is absent.
- Final-day choosing and rating reminders sent only to incomplete members.
- Admin-only production Time Machine with confirmation and direct next-phase
  shortcuts that preserve the listening interval and send phase emails.
- Development-only dummy data.
- Plain-language English and German interface for the sign-in, circle setup,
  and core round flow.
- Supabase RLS and production migrations.
- Custom production domain at `https://gems-music.com`, with the legacy Vercel
  alias retained.
- Repository-scoped Git history and GitHub remote.
- Durable cross-chat operations runbook for local setup, migrations, Vercel
  production release, verification, rollback, and role access.

## Reliability next

- Add an automated test foundation for phase calculation, URL parsing, scoring,
  RLS-sensitive workflows, and critical UI flows.
- Verify immediate manual event delivery plus the daily Vercel Cron fallbacks
  and its logs after the first production day with a configured Resend sender.
- Add a production smoke-test script that checks HTTP availability, cloud
  Supabase configuration, authentication CORS, and absence of localhost URLs.
- Add error reporting or lightweight observability that stays within free-tier
  limits.
- Verify restore and backup expectations for the Supabase Free project.

## Product improvements

- Improve circle invitation onboarding and make pending approval status clearer.
- Add finer notification preferences per user, not only per circle.
- Make the existing promote-then-leave admin transfer flow explicit and easier
  to understand.
- Add accessible confirmation UI instead of native browser confirmation dialogs.
- Improve user discovery with relationship context while preserving circle
  privacy.

## Maintainability

- Split `src/components/gems-app.tsx` into cohesive feature components and hooks.
- Generate and use typed Supabase database definitions.
- Centralize provider parsing and phase calculations in tested domain modules.
- Remove no-longer-used Vite, Vinext, Cloudflare, and Wrangler dependencies
  after reviewing the user-owned lockfile state.
- Review the dependency and lockfile state after the hosting transitions.
- Update the Vercel service-limit card now that Vercel is the active host.

## Explicitly deferred

- Paid email delivery or paid API integrations.
- Public circle discovery.
- Spotify or YouTube OAuth requirements for the core experience.
- Commercial-scale hosting changes before free-tier usage justifies them.
