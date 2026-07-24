# The Hydration Code

Faceless, SEO-first affiliate content site about microplastics and glass water bottles.

Static Astro 5 · Tailwind 4 · MDX content in git · AWS Amplify hosting. Optional Keystatic CMS, off by default.

## Getting started

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

Site runs at `http://localhost:4321`.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Local dev server with HMR |
| `pnpm build` | Production build into `dist/` (runs the affiliate-link guard first) |
| `pnpm preview` | Serve the built site locally |
| `pnpm check` | Type-check Astro/TS, then the schema-drift check, then the affiliate-link guard |
| `pnpm lint:affiliates` | Just the affiliate-link guard, standalone |
| `pnpm check:schema-drift` | Just the Zod/Keystatic schema-drift check, standalone |

## Where things live

```
src/
  content.config.ts       Content schemas (Zod). Single source of truth for posts/bottles.
  content/posts/          Articles (MDX) — 3 seed articles, one per pillar
  content/bottles/        Product entries (YAML) — 4 seed bottles
  data/affiliates.ts      Aggregates data/affiliates/*.json — see below
  data/affiliates/*.json  THE ONLY place merchant URLs may appear (one file per id)
  data/site.ts            Sitewide code constants (name, url, nav) — re-exports settings below
  data/site-settings.json Hero copy, footer text, homepage stat band — CMS-editable
  lib/pricing.ts          Amazon price-display compliance logic
  lib/analytics.ts        Provider-agnostic event tracking
  components/seo/         JSON-LD (Organization, WebSite, Article, Product+Review, FAQPage, BreadcrumbList)
  pages/go/[id].astro     Cloaked affiliate redirects
  pages/og/               Auto-generated OG images (posts + bottles)
  styles/global.css       Design tokens. Never hardcode a hex elsewhere.
scripts/
  check-affiliate-links.mjs  Merchant-domain guard — wired into `build` and `check`
  check-schema-drift.mjs     Zod vs. Keystatic schema drift — wired into `check`
keystatic.config.ts       CMS config. Build-time optional — see docs/CMS.md.
docs/
  PROJECT_SPEC.md         Full build brief
  DEPLOY.md               Amplify setup, plus the S3+CloudFront alternative
  AFFILIATE.md            Program status, compliance rules, PA-API notes
  CMS.md                  Keystatic: turning it on, adding content, GitHub mode, dependency pins
```

## The CMS

`/keystatic` is gated behind `KEYSTATIC_ENABLED=true` (unset by default). With the flag off — the
production default — `astro.config.mjs` never loads `@astrojs/node`, `@astrojs/react`, or
`@keystatic/astro` at all; the build is pure static output, identical to a version of this project
with no CMS. See `docs/CMS.md` before touching anything Keystatic-related, including before
upgrading Astro — several dependencies are pinned deliberately against the current Astro version.

## Before you launch

- [ ] Only 3 seed articles exist (one per pillar). `docs/AFFILIATE.md` requires 10+ original posts,
      most recent within 60 days, before applying to Amazon Associates — write more first
- [ ] `AMAZON_ASSOCIATE_TAG` / `SHAREASALE_ID` / `IMPACT_ID` are still blank — affiliate links build
      and work, they just don't earn anything yet
- [ ] All product images are placeholders (`src/assets/images/{bottles,posts,hero}/`) — replace before
      launch, real product photos and hero art are not in place
- [ ] `Organization.logo` and `Article.publisher.logo` point at `public/logo-600x60.png`, a generated
      placeholder wordmark — swap for real brand art
- [ ] Contact email (`hello@thehydrationcode.com`, used on the legal pages) is a placeholder — set up
      a real inbox before publishing those pages
- [ ] `PUBLIC_NEWSLETTER_ENDPOINT` is blank — the form degrades gracefully but doesn't send anywhere yet
- [ ] Amplify's `amplify.yml` assumes `KEYSTATIC_ENABLED` stays unset in production. If that ever
      changes, `docs/CMS.md` has the deployment implications
- [ ] `pnpm check` and `pnpm build` both pass clean
- [ ] Lighthouse 95+ across all four categories, all page types (see `docs/PROJECT_SPEC.md` §7 and the
      most recent build's Lighthouse run for current scores)

## Read first

`CLAUDE.md` holds the conventions, design tokens, and hard rules — including hard rule 7 (citations
must link the actual source, readable without payment), which is the rule this codebase has needed
correcting toward most often.
