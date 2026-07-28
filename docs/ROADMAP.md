# Gems roadmap

Last updated: 2026-07-28

This is the shared status board for future chats. Move work between sections as
its status changes; do not duplicate the same item in multiple sections.

## Shipped

- Email/password signup, confirmation, sign-in, reset, and password change.
- Unique immutable nicknames and circle names.
- Circle creation, exact-name join requests, approval, removal, leaving, and
  archiving.
- Expiring private invitation links.
- Multiple-circle switching.
- Twelve-day submit, rate, reveal, and persistent history flow.
- Spotify and YouTube parsing, embedded playback, metadata, and original links.
- Five reactions with generated point values and per-user rating updates.
- Streak calculation when a subsequent round starts.
- Profile totals, reactions received, and nickname search.
- Circle admin view with rules, lifecycle, invitations, notification controls,
  member management, and free-tier reference limits.
- Browser push subscription and idempotent notification delivery logic.
- Cost-safe email controls and dry-run behavior when Resend is absent.
- Admin-only production Time Machine with confirmation.
- Development-only dummy data.
- Supabase RLS and production migrations.
- Public Vercel deployment at `https://gems-rosy.vercel.app`.
- Repository-scoped Git history and GitHub remote.

## Reliability next

- Add an automated test foundation for phase calculation, URL parsing, scoring,
  RLS-sensitive workflows, and critical UI flows.
- Add a free-tier-compatible daily scheduler for `/api/cron/rounds`, or document
  the chosen external scheduler and its monitoring.
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
- Add optional localization after the English product flow is stable.

## Maintainability

- Split `src/components/gems-app.tsx` into cohesive feature components and hooks.
- Generate and use typed Supabase database definitions.
- Centralize provider parsing and phase calculations in tested domain modules.
- Remove hosting-specific build dependencies that are no longer needed after
  confirming Vercel is the sole supported production target.
- Review the dependency and lockfile state after the hosting transitions.
- Update the Vercel service-limit card now that Vercel is the active host.

## Explicitly deferred

- Paid email delivery or paid API integrations.
- Public circle discovery.
- Spotify or YouTube OAuth requirements for the core experience.
- Commercial-scale hosting changes before free-tier usage justifies them.
