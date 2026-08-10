# Gems repository guidance

## Start here

Before changing product behavior, read:

1. `APP_RULES.md` for product rules and user-facing behavior.
2. `docs/ARCHITECTURE.md` for system boundaries, data ownership, security, and deployment.
3. `docs/OPERATIONS.md` for the canonical local, migration, and Vercel production runbook.
4. `docs/ROADMAP.md` for current status and known gaps.
5. `docs/DECISIONS.md` when a change revisits an existing product or technical decision.

Do not assume another chat's transcript is available. Treat the repository,
current working tree, Git history, migrations, and these documents as the shared
source of truth.

## Stack and structure

- Next.js 16 App Router, React 19, and TypeScript.
- Tailwind CSS 4, Shadcn UI/Radix primitives, and Lucide icons.
- Supabase Auth and PostgreSQL with strict Row Level Security.
- Vercel Hobby is the primary production host.
- `https://gems-music.com` is the canonical public production URL; the
  `gems-rosy.vercel.app` URL is a fallback alias.
- Vercel is the only supported deployment target. Do not add or restore a
  Sites/Cloudflare hosting binding without explicit user approval.
- Product UI currently lives mainly in `src/components/gems-app.tsx`.
- Database changes are forward-only migrations under `supabase/migrations/`.

This Next.js version has breaking changes. Before changing framework behavior,
read the relevant guide under `node_modules/next/dist/docs/` and heed
deprecation notices.

## Product and security invariants

- Store database timestamps in UTC and present phase time as countdowns.
- A circle contains 2–8 approved members before a round can start.
- Nicknames and circle names are unique and immutable.
- Only approved members may access circle data.
- Only circle admins may manage membership, settings, rounds, invitations, and
  the Time Machine.
- Preserve RLS. Never solve an authorization problem by weakening a policy or
  moving unrestricted service-role access into the browser.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`,
  `VAPID_PRIVATE_KEY`, `CRON_SECRET`, or other secrets to client code or Git.
- Keep email notifications disabled by default and do not introduce paid
  services without explicit user approval.
- Time Machine may run in production for circle admins, but it must retain a
  confirmation because it changes shared live deadlines.
- Dummy data and seed utilities must remain unavailable in production.

## Working agreements

- Inspect the current implementation and migrations before proposing a schema
  or behavior change.
- Gems supports English and German. Every new or changed user-facing string,
  state, dialog, label, and validation message must be added and reviewed in
  both languages in the same change. In German, use **Circle** (not
  **Kreis**) as the product term.
- Make the smallest cohesive change that completes the requested outcome.
- Preserve unrelated user changes in a dirty working tree.
- Add a new Supabase migration for schema, trigger, function, grant, or RLS
  changes. Never rewrite an already-applied migration.
- Prefer database constraints and RLS for invariants that must hold across all
  clients.
- Keep production and local environment values separate. Never deploy a bundle
  containing `127.0.0.1:54321` as its Supabase URL.
- Use free-tier-compatible designs unless the user explicitly approves a paid
  dependency or service.

## Validation

For normal code changes, run:

```bash
npm run lint
npm run build
```

Also run checks proportional to the change:

- Schema/RLS: inspect the migration and verify grants and policies.
- Authentication: verify the production redirect URL and browser CORS path.
- Deployment: verify HTTP 200, the cloud Supabase hostname in the live bundle,
  and the absence of localhost URLs.
- User-facing UI: verify the relevant empty, loading, success, and error states.

Do not report a deployment as complete until the permanent production alias is
ready and the live behavior has been checked.

## Git and delivery

- Keep commits focused and use descriptive imperative messages.
- The repository-scoped Git author uses GitHub's noreply identity.
- After completing and validating a requested change, commit and push it to
  `origin/main` unless the user asks to keep it local.
- Do not include `.env*`, `.vercel/`, build artifacts, or unrelated generated
  lockfile changes in commits.
- Deployment is a separate external action. Deploy when the user requests it or
  when the active task explicitly includes production delivery.
- For a Vercel production deployment, follow `docs/OPERATIONS.md` exactly:
  pull Production values, export them before building, verify no local Supabase
  URL entered the artifact, stage a secret-free prebuilt runtime outside Git,
  deploy it, and verify the permanent alias. A Git push alone is never a deploy.

## Living documentation

- Update `APP_RULES.md` when product behavior, roles, permissions, lifecycle
  rules, or notification semantics change.
- Update `docs/ARCHITECTURE.md` when the database, integrations, security
  boundaries, runtime, environment variables, or deployment process change.
- Update `docs/ROADMAP.md` when starting, completing, deferring, or discovering
  material product work.
- Add an entry to `docs/DECISIONS.md` for consequential decisions and meaningful
  reversals. Do not rewrite old decisions; mark them superseded.
- Update `README.md` when setup or operator instructions change.
- Update `docs/OPERATIONS.md` whenever the reliable local, migration, release,
  rollback, domain, or verification procedure changes.
- Include relevant documentation in the same commit as the implementation.
- Do not churn documentation for internal refactors that do not affect
  behavior, architecture, operations, or planned work.
