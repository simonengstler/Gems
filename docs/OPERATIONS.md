# Gems operations runbook

Last updated: 2026-10-11

This is the operational handoff for a fresh chat. Read it before changing the
database, environment configuration, or production deployment.

## Production facts

| Concern | Canonical value |
| --- | --- |
| Public production URL | `https://gems-music.com` |
| Fallback Vercel URL | `https://gems-rosy.vercel.app` |
| Public host | Vercel project `gems` |
| Source repository | `git@github.com:simonengstler/Gems.git`, branch `main` |
| Backend | Linked cloud Supabase project; its hostname must be read from Vercel Production environment values, never copied into documentation |
| Local backend | Supabase at `http://127.0.0.1:54321` only |

Vercel is the only supported production and preview deployment target. The
previous private ChatGPT Sites wiring was removed so that future agents do not
mistake it for the public application. Do not add a Sites/Cloudflare hosting
binding without explicit user approval.

## Read order for a new chat

1. `AGENTS.md` — non-negotiable working and security rules.
2. `APP_RULES.md` — user-visible product behavior.
3. `docs/ARCHITECTURE.md` — boundaries, data model, authorization, and runtime.
4. This file — local setup, release, rollback, and verification.
5. `docs/ROADMAP.md` and `docs/DECISIONS.md` — current work and decisions that
   must not be accidentally reversed.
6. The current working tree, Git history, and migrations — resolve any conflict
   in favour of the most recent concrete repository state.

## Local development

Requirements: Node.js 20.9 or newer, Docker Desktop, npm, a logged-in Supabase
CLI, and a linked Vercel CLI for production work.

```bash
npx supabase@latest start
npm install
npm run dev
```

Use `.env.local` only for local values. Get the local public Supabase URL and
key with `npx supabase@latest status`. Never use a local URL in a production
build.

Normal source validation:

```bash
npm run lint
npm run build
```

The build fetches Geist fonts. If the sandbox blocks that network request, rerun
the build with the required network permission rather than changing fonts or
weakening validation.

## Database changes

1. Inspect existing migrations and current RLS/function/trigger behavior.
2. Add one new timestamped, forward-only SQL migration under
   `supabase/migrations/`. Never edit an applied migration.
3. Put cross-client invariants in constraints, triggers, RLS, or a narrowly
   scoped database function; UI visibility is not authorization.
4. Review the migration for grants, revokes, policies, `security definer`
   search paths, and backwards compatibility.
5. Apply the migration to the linked cloud project before deploying application
   code that depends on it:

```bash
npx supabase db push --include-all
```

The Supabase CLI may emit a warning when caching its migration catalog after a
successful push. Treat `Finished supabase db push` with exit code 0 as success;
investigate any migration execution error before deploying the app.

## Production deployment

Deployment is the default external action after every validated, committed
product fix or change. Skip it only when the user explicitly asks to keep work
local.

Vercel is not reliably connected to the GitHub author identity. Do **not** use
a normal source deployment. Build locally using Vercel Production environment
values, then deploy a prebuilt artifact staged outside the Git worktree.

The CLI may default to a personal scope even when the project belongs to a
team, causing `Not authorized` during deployment. Confirm access with
`npx vercel whoami` and `npx vercel teams ls`. Set `VERCEL_SCOPE` to the slug of
the team owning the linked project (check the local `.vercel/project.json` and
Vercel dashboard). Keep that account-specific value outside Git. Confirm the
project appears in `npx vercel project ls --scope "$VERCEL_SCOPE"`, then include
`--scope "$VERCEL_SCOPE"` on all production Vercel commands.

Production email requires all of `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and
`CRON_SECRET` in the Vercel Production environment. Check their presence with
`npx vercel env ls production`; without a Resend API key and verified sender,
no email can be delivered. After changing any of these values, redeploy and use
the circle admin’s **Send test email to me** action to verify delivery.

### Release sequence

1. Validate source and commit the focused change. Push `main`.
2. If there is a migration, apply it with `npx supabase db push --include-all`.
3. Pull Vercel Production values:

```bash
npx vercel pull --yes --environment=production --scope "$VERCEL_SCOPE"
```

4. Inspect the pull result before building. Vercel marks sensitive values as
`[SENSITIVE]` because they cannot be downloaded. Gems only needs the real
`NEXT_PUBLIC_*` values during compilation; server credentials are read inside
request handlers and supplied by Vercel at runtime. Never substitute local
Supabase credentials or upload those placeholders as runtime overrides.
If any public build value is unavailable, stop the release. Remove only the
known server-only placeholder lines from the local build cache:

```bash
python3 - <<'PYBUILD'
from pathlib import Path
path = Path('.vercel/.env.production.local')
lines = path.read_text().splitlines()
allowed = {'CRON_SECRET', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL',
           'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'VAPID_PRIVATE_KEY'}
missing = {line.split('=', 1)[0] for line in lines if '[SENSITIVE]' in line}
assert missing <= allowed, 'A public build value is unavailable; stop release'
path.write_text('\n'.join(line for line in lines if '[SENSITIVE]' not in line) + '\n')
PYBUILD
```

Export the remaining Production values so they take precedence over
`.env.local`, then make the production artifact. Disable package lifecycle
scripts during the build's dependency-install step:

```bash
set -a && source .vercel/.env.production.local && set +a
npm_config_ignore_scripts=true npx vercel build --prod --scope "$VERCEL_SCOPE"
```

The Next.js log can still say that it read `.env.local`; the exported process
values take precedence. Confirm the generated `.vercel/output` contains the
cloud Supabase hostname and no `127.0.0.1:54321` or `localhost:54321` string
before continuing.

5. Vercel's prebuilt metadata may list `.env.local` as a traced input even
though it must not be uploaded. Remove only that generated input mapping and
validate the JSON:

```bash
find .vercel/output/functions -name '.vc-config.json' \
  -exec perl -ni -e 'print unless /"\\.env\\.local": "\\.env\\.local"/' {} +
find .vercel/output/functions -name '.vc-config.json' -print0 | xargs -0 -n1 jq empty
```

6. Stage the traced runtime in a temporary directory. Do not use a directory
that contains `.git` or local environment files:

```bash
release_dir=$(mktemp -d /private/tmp/gems-vercel-deploy.XXXXXX)
rsync -a \
  --exclude='/.git' \
  --exclude='/dist' \
  --exclude='/.wrangler' \
  --exclude='/.env.local' \
  --exclude='/.vercel/.env.production.local' \
  "$PWD/" "$release_dir/"
npx vercel deploy --prebuilt --prod --yes --scope "$VERCEL_SCOPE" --cwd "$release_dir"
```

Do not exclude `.next` or nested `node_modules/**/dist`: Vercel's traced
functions need them. A successful deployment must report that the primary
domain or `gems-rosy.vercel.app` was aliased.

### Post-deploy verification

Verify all of the following before saying production is complete:

```bash
curl -sS -I https://gems-music.com
```

- The primary URL returns HTTP 200.
- The Vercel deployment reports `READY` and the alias was updated.
- The downloaded browser bundle contains the cloud Supabase hostname and no
  localhost Supabase URL.
- The downloaded browser bundle contains the changed UI text or behavior. An
  HTTP 200 alone can be served from a stale alias or cache, so verify the
  specific change before reporting success.
- The changed user-facing path works in the browser, including empty, loading,
  success, and error states relevant to the change.
- For authentication changes, test the configured production redirect path.
- For database/RLS changes, confirm the newly deployed UI and the database
  function or policy agree on the authorization rule.

## Rollback and operator access

For an application rollback, promote a previously verified Vercel deployment;
do not rewrite or delete a production database migration. Compensate a database
mistake with a new forward-only migration.

Circle admins enter the circle Admin view from the labeled **Admin** control in
the circle header (and the Admin mobile tab). Platform operators are different:
they need an explicit `platform_admins` row, provisioned by a database operator
in Supabase. There is intentionally no browser self-service path for granting
platform access.

## Persistent pitfalls

- Keep unrelated dirty files, especially generated `package-lock.json` changes,
  out of a focused commit unless they are required by the task.
- Never commit `.env*`, `.vercel/`, build artifacts, temporary release folders,
  or Supabase local state.
- Never expose service-role, Resend, VAPID private, or cron values to client
  code, documentation, Git, or tool output.
- Do not report a push to GitHub as a deployment.
- Do not confuse a circle admin with a platform operator.
