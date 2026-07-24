# Deploy

## Current: AWS Amplify Hosting

Static output, git-triggered builds. Roughly $1–5/month at launch traffic.

### Setup

1. Push the repo to GitHub
2. Amplify console → **Create new app** → GitHub → select the repo and branch
3. Amplify detects `amplify.yml`. Confirm build output is `dist`
4. **App settings → Environment variables** — add everything from `.env.example`
   except the `KEYSTATIC_*` values
5. **Hosting → Custom domains** → add `thehydrationcode.com`. If the domain is
   in Route 53 in the same account, Amplify handles DNS and the certificate
   automatically. Otherwise add the CNAME records it gives you.
6. Set the apex to redirect or serve directly, and force `www` → apex (or the
   reverse — pick one and be consistent, it matters for SEO)

### Gotchas

- Build minutes are billed but negligible at this cadence
- Amplify serves `dist/` as-is; there is no server. Anything needing SSR
  (Keystatic GitHub mode) requires the Astro Amplify adapter and a separate
  decision
- Cache invalidation is automatic on deploy
- **As of Phase 6, `astro.config.mjs` has an adapter (`@astrojs/node`) so the
  `/keystatic` admin route can run on-demand — the public site itself is
  still 100% static output.** This changed the build's output shape:
  `pnpm build` now writes static files to `dist/client/` and an SSR server
  entry to `dist/server/`, not directly to `dist/`. `amplify.yml` still says
  `baseDirectory: dist`, which is now wrong — this hasn't been updated
  because the admin isn't being deployed yet (see `docs/CMS.md`). Before the
  *next* production deploy, this needs a real decision: at minimum
  `baseDirectory: dist/client`, and if Keystatic's GitHub mode is going
  live too, a compute/SSR configuration for `/keystatic` and
  `/api/keystatic` specifically.

## Alternative: S3 + CloudFront + OAC

Cheaper at scale and more controllable, but it is CDK work you do not need yet.

Shape: private S3 bucket → CloudFront distribution with Origin Access Control →
ACM cert in `us-east-1` → Route 53 alias record → CloudFront Function for
trailing-slash and index-document rewrites → GitHub Action that syncs `dist/`
and issues an invalidation.

Worth migrating when hosting cost becomes a real line item or you need edge
logic. Not before.

## Analytics

Plausible. Set `PUBLIC_PLAUSIBLE_DOMAIN` and add the script in the base layout.
No cookies, so no consent banner is required.
