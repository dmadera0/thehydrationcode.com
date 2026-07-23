# The Hydration Code

Faceless, SEO-first affiliate content site about microplastics and glass water bottles.

Static Astro 5 · Tailwind 4 · MDX content in git · AWS Amplify hosting.

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
| `pnpm build` | Production build into `dist/` |
| `pnpm preview` | Serve the built site locally |
| `pnpm check` | Type-check Astro, TS, and content schemas |

## Where things live

```
src/
  content.config.ts    Content schemas. Single source of truth.
  content/posts/       Articles (MDX)
  content/bottles/     Product entries (YAML)
  data/affiliates.ts   THE ONLY place merchant URLs may appear
  data/site.ts         Sitewide copy and the homepage stat band
  lib/pricing.ts       Amazon price-display compliance logic
  lib/analytics.ts     Provider-agnostic event tracking
  pages/go/[id].astro  Cloaked affiliate redirects
  styles/global.css    Design tokens. Never hardcode a hex elsewhere.
docs/
  PROJECT_SPEC.md      Full build brief
  DEPLOY.md            Amplify setup, plus the S3+CloudFront alternative
  AFFILIATE.md         Program status, compliance rules, PA-API notes
```

## Before you launch

- [ ] Verify all four figures in `src/data/site.ts` — three are unverified
- [ ] 12+ published articles before applying to Amazon Associates
- [ ] Affiliate disclosure renders above the first affiliate link on every page
- [ ] Every bottle lists at least two real cons
- [ ] `pnpm check` passes clean
- [ ] Lighthouse 95+ across all four categories

## Read first

`CLAUDE.md` holds the conventions, design tokens, and hard rules.
