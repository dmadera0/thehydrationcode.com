# Claude Code Build Prompt — The Hydration Code

> Paste everything below the line into Claude Code in an empty repo directory.

---

# PROJECT: The Hydration Code

Build a production-ready, SEO-first affiliate content website. This is a **content authority site**, not a store. Revenue comes from affiliate commissions on glass/non-plastic water bottles. There is **no personal brand, no author photos, no on-camera persona** — credibility comes from citations and data.

Work in phases. After each phase, stop and summarize what you built and what's next. Do not scaffold the entire thing in one shot.

---

## 0. What already exists — build on it, don't regenerate it

The repo is scaffolded. These files are already written and are considered decided:

```
CLAUDE.md                 conventions, tokens, hard rules
package.json              deps and scripts
astro.config.mjs          static output, mdx, sitemap, tailwind v4 via vite
tsconfig.json             strict, with @/ @components/ @lib/ @data/ aliases
amplify.yml               pnpm build pipeline
.env.example              every env var the project uses
public/robots.txt         /go/ disallowed
src/styles/global.css     design tokens under @theme — the token layer is final
src/content.config.ts     posts + bottles schemas — the content model is final
src/data/affiliates.ts    affiliate registry + tracked URL builder
src/data/site.ts          sitewide copy, nav, homepage stat band
src/lib/pricing.ts        Amazon price-display compliance
src/lib/analytics.ts      provider-agnostic track()
src/pages/go/[id].astro   cloaked affiliate redirects
src/content/bottles/purelane-classic.yaml   reference entry showing the schema
docs/                     DEPLOY.md, AFFILIATE.md, this file
```

Read `CLAUDE.md` and `src/content.config.ts` before writing anything. If you believe a decision in these files is wrong, say so and explain why — do not silently change it.

Start at Phase 1.

---

## 1. Stack (non-negotiable unless you hit a blocker — flag it if so)

- **Astro 5** with `output: 'static'` — this is a content site, ship zero JS by default
- **TypeScript**, strict mode
- **Tailwind CSS v4** via `@tailwindcss/vite`
- **MDX** for blog posts via `@astrojs/mdx`
- **Astro Content Collections** with Zod schemas for type-safe content
- `@astrojs/sitemap`, `astro-seo` (or hand-rolled meta component — your call, justify it)
- **Sharp** for image optimization via Astro's `<Image />`
- No React/Vue/Svelte unless a specific component genuinely needs it. If one does (e.g. the email form), use an Astro island with `client:visible`.

Deploy target: **AWS Amplify Hosting** pointed at the GitHub repo. Include `amplify.yml`. Also include a commented alternative path (S3 + CloudFront + OAC via CDK) in `docs/DEPLOY.md`, but don't build it.

Node 20+. Use `pnpm`.

---

## 2. Brand system

Implement as Tailwind theme tokens in `src/styles/global.css` using `@theme`. Never hardcode hex values in components.

```
--color-brand:        #1A6B4D   /* Deep Water Green — primary, CTAs, headers */
--color-brand-dark:   #124F39   /* hover/pressed state, derive if needed */
--color-brand-tint:   #E8F0EC   /* pale green section backgrounds */
--color-accent:       #0066CC   /* Crisp Blue — links, data viz, badges. Use SPARINGLY */
--color-ink:          #1A1A1A   /* headings */
--color-body:         #4A4A4A   /* body copy */
--color-surface:      #FFFFFF
--color-border:       #E5E7EB
```

**Typography:** Montserrat for headings (600/700), Inter for body (400/500). Self-host via `@fontsource-variable` — no Google Fonts CDN calls (privacy + LCP). Body minimum 16px, generous line-height (1.65). Headings tight tracking.

**Visual direction:** clean, editorial, high-whitespace. Think a research publication that happens to have good taste. Rounded corners (8–12px), soft borders instead of heavy shadows, full-bleed green stat bands to break up white sections. No gradients, no glassmorphism, no decorative illustration.

---

## 3. Voice rules (apply to every string you write)

- Authoritative but conversational. Trusted researcher, not salesperson.
- Every factual claim carries a citation with source name + year.
- No corporate speak, no hype adjectives, no exclamation marks.
- Copy should be quotable — write lines people screenshot.
- Never claim to manufacture or own any product.

---

## 4. Site architecture

```
/                          Homepage
/research                  Article index, filterable by pillar
/research/[slug]           Article page
/best-bottles              Product roundup / comparison hub
/best-bottles/[slug]       Individual bottle review pages
/our-method                How we evaluate + editorial standards + who we are (faceless, stated plainly)
/affiliate-disclosure      FTC-compliant
/privacy
/terms
/404
/rss.xml
/sitemap-index.xml
/robots.txt
```

Content pillars used as taxonomy: `science-of-plastic`, `why-glass-matters`, `health-optimization`.

### Homepage sections, in order
1. **Header** — logo (droplet mark + wordmark "THE HYDRATION CODE" / kicker "DRINK SMARTER"), nav: Home / The Research / Best Bottles / Our Method, plus a solid-green "Shop Glass Bottles" CTA button. Sticky on scroll, subtle border-bottom.
2. **Hero** — pale green background. Left: eyebrow pill badge ("Research-backed hydration"), H1 "Know exactly what you're drinking.", supporting paragraph, two CTAs (primary "Read the Research", secondary outline "See Best Glass Bottles"), micro-trust line "Every claim cited. No personal brand — just the data." Right: full-bleed rounded image slot.
3. **Stat band** — full-width deep green, 4 stats in a row, each with large numeral, one-line explainer, and a small-caps source attribution underneath. Collapses to 2×2 on mobile.
4. **Start with the research** — 3 featured article cards: category pill, image, title, dek, read time, "Read →".
5. **Three questions we answer with evidence** — 3 pillar cards with icon, title, description, "Explore →".
6. **Glass bottles we actually recommend** — 4 product cards (see §5), one flagged "Editor's Choice", plus "View all bottles →".
7. **Newsletter** — deep green rounded panel, mail icon, headline "The Hydration Code, in your inbox", subcopy, email input + blue submit button, reassurance line.
8. **Footer** — logo + brand promise, four columns (Learn / Shop / Company), affiliate disclosure paragraph, copyright.

---

## 5. Content model

### `src/content/posts/` (MDX)
```ts
{
  title: string
  slug: string
  dek: string            // 1–2 sentence summary, used in cards + meta description
  pillar: 'science-of-plastic' | 'why-glass-matters' | 'health-optimization'
  publishedAt: date
  updatedAt: date optional
  readingTime: number    // computed at build, not authored
  heroImage: image
  heroAlt: string
  featured: boolean
  sources: Array<{ label: string, url: string, publisher: string, year: number }>
  faq: Array<{ q: string, a: string }> optional
  relatedBottles: reference[] optional
}
```

Build MDX components available to every post: `<Callout>`, `<StatBlock>`, `<Citation id="">`, `<ComparisonTable>`, `<BottleCard slug="">`, `<KeyTakeaways>`. Auto-render a **Sources** section at the bottom of every article from the `sources` array, numbered and linked.

### `src/content/bottles/` (YAML or MD)
```ts
{
  name: string
  brand: string
  slug: string
  priceDisplay: 'hidden' | 'range' | 'exact'   // see PRICE RULE below
  priceRange: string optional                   // e.g. "$30–40", safe to hardcode
  price: number optional                        // ONLY for non-Amazon merchants
  currency: 'USD'
  rating: number         // 0–5, one decimal
  tagline: string
  bestFor: string        // "Home & desk", "Commute & gym", etc.
  editorsChoice: boolean
  features: string[]     // 3 bullets, checkmark rendered
  image: image
  affiliateId: string    // FK into the affiliate link registry, see §6
  material: string
  capacityOz: number
  dishwasherSafe: boolean
  lidType: string
  pros: string[]
  cons: string[]         // REQUIRED, minimum 2. Credibility depends on this.
}
```

**PRICE RULE — important compliance constraint.** Amazon's Operating Agreement prohibits displaying Amazon prices unless they come from the Product Advertising API and are refreshed within 24 hours. PA-API access isn't granted until after three qualifying sales. So:

- For any bottle whose `affiliateId` resolves to `network: 'amazon'`, default `priceDisplay: 'hidden'` and render the CTA as **"Check price ↗"** instead of a dollar figure.
- Build the card so a price slot exists and lights up automatically when `priceDisplay` changes — we'll flip it on once PA-API is live.
- For non-Amazon merchants (direct brand programs, ShareASale, Impact), showing a price is fine; use `priceRange` and add an "as of {date}" microcopy line.
- Leave a `TODO: wire PA-API` stub in `src/lib/pricing.ts` with the intended interface.

Product card renders: image, brand eyebrow + star rating, name, tagline, "Best for" pill, checkmark feature list, price slot (per rule above), and a "View Bottle ↗" / "Check price ↗" button.

---

## 6. Affiliate link handling — do this properly

Create a single registry at `src/data/affiliates.ts`:

```ts
export const affiliates = {
  'purelane-classic': {
    network: 'amazon',
    url: 'https://www.amazon.com/dp/PLACEHOLDER?tag=REPLACE-20',
    label: 'Purelane Classic Cork-Top',
  },
  // ...
} as const
```

Requirements:
- Every outbound affiliate link goes through a cloaked path: `/go/{id}`
- Redirects are generated as static pages by `src/pages/go/[id].astro`, whose `getStaticPaths()` reads the registry. Amplify has no file-based redirect config the way Netlify does, and a CloudFront Function is unnecessary infrastructure here — a generated page per id is host-agnostic and gives us a place to fire the click event before redirecting. **This route already exists. Do not replace it.**
- Every affiliate `<a>` gets `rel="sponsored nofollow noopener"` and `target="_blank"`
- Block `/go/*` in `robots.txt`
- Fire an analytics event on click with the affiliate id
- Build a `<AffiliateLink>` component that is the *only* way any affiliate URL is rendered anywhere in the codebase. Lint against raw amazon.com links elsewhere.
- Tag IDs and network params come from `.env`, never committed

---

## 7. SEO requirements

- Unique title + meta description per page, driven by content frontmatter
- Canonical URLs, OG + Twitter card tags
- **JSON-LD**: `Organization` + `WebSite` sitewide; `Article` on posts; `Product` + `AggregateRating` on bottle pages; `FAQPage` when `faq` exists; `BreadcrumbList` on all nested pages
- Auto-generated OG images per post (Satori/`astro-og-canvas`) using brand colors + title
- Semantic heading hierarchy, one H1 per page
- Internal linking: every article auto-suggests 3 related posts by pillar, plus relevant bottle cards
- `sitemap-index.xml` and a real `robots.txt`
- Target Lighthouse 95+ across all four categories. No CLS from images — always set dimensions.

---

## 8. Email capture

Ship a `<NewsletterForm>` island that POSTs to a configurable endpoint (`PUBLIC_NEWSLETTER_ENDPOINT` in `.env`), designed for Kit/ConvertKit or Beehiiv's form API. Include: honeypot field, client-side validation, loading state, success and error states, and an `aria-live` region. Do not build a custom backend for this.

---

## 9. Compliance and trust (this is what makes the site rank and convert)

- Affiliate disclosure visible **above the first affiliate link** on any page containing one, plus in the footer, plus a dedicated page. FTC requires it be unavoidable — not buried.
- `/our-method` must explain the evaluation criteria honestly and state that the site is operated anonymously and reader-supported.
- Every bottle needs real cons listed.
- Cookie/privacy policy consistent with whatever analytics ships.

---

## 10. Analytics

Use **Plausible** (`PUBLIC_PLAUSIBLE_DOMAIN` env var), self-hostable later, no cookie banner needed. Custom events: `affiliate_click` (with id + placement), `newsletter_submit`, `pillar_click`. Wrap in a tiny `track()` util so the provider can be swapped.

---

## 11. Seed content

Create the following as real, complete content — not lorem ipsum:

**Articles (full MDX, 1,200+ words each, properly cited):**
1. "What 240,000 Microplastics Per Liter Actually Means For Your Body" — pillar: science-of-plastic
2. "Glass vs. Stainless Steel: Which Bottle Is Actually Better?" — pillar: why-glass-matters
3. "Hydration and Athletic Performance: What The Research Shows" — pillar: health-optimization

**Bottles (4, placeholder brands/prices as listed):**
- Purelane — Classic Cork-Top Glass Bottle, $32, 4.8, Editor's Choice, best for Home & desk
- Vireo — Protected Glass Bottle with Silicone Sleeve, $38, 4.7, best for Commute & gym
- Ora — Tall Minimalist Glass Bottle, $29, 4.6, best for Everyday carry
- Botanica — Fruit-Infuser Glass Bottle, $36, 4.5, best for Flavor lovers

**Stat band figures** (mark each with a `TODO: verify` comment in the source data file):
- 240,000 plastic particles per liter of bottled water — PNAS, 2024
- 90% of bottled water samples contained microplastics — WHO review
- 2% body-water loss measurably impairs performance — Sports Med
- <10% of plastic bottles are recycled into new bottles — OECD

**Critical:** Do not invent studies, DOIs, or statistics beyond what's listed above. If a claim in an article needs support you can't source, write the claim with a `{/* NEEDS SOURCE */}` comment rather than fabricating a citation. Use placeholder images from a local `/public/images/placeholder/` directory with clear filenames — do not hotlink stock photos.

---

## 11a. Admin interface (CMS)

Integrate **Keystatic** (`@keystatic/core`, `@keystatic/astro`) so content can be edited through a browser UI rather than by hand-editing files.

- Config at `keystatic.config.ts`, schema mirroring the content collections in §5 exactly — do not let the two drift. If Zod and Keystatic schemas can share a source of truth, do that.
- Collections exposed in the admin: **Posts**, **Bottles**, **Affiliates** (the registry from §6), and a **Site Settings** singleton (stat-band figures, hero copy, footer text).
- Rich MDX editing for posts, including the custom components (`Callout`, `StatBlock`, `ComparisonTable`, `BottleCard`) registered as editor blocks so they're insertable from the UI.
- Image uploads write to `src/assets/images/{collection}/` and are referenced through Astro's `<Image />` pipeline.
- Start in **`local` mode** (`storage: { kind: 'local' }`) — admin runs at `http://localhost:4321/keystatic` against the working tree.
- Also wire a **`github` mode** config behind an env flag (`KEYSTATIC_STORAGE=github`) with setup instructions in `docs/CMS.md`, including the GitHub App creation steps and the fact that GitHub mode requires an SSR-capable route. Do not deploy it yet — just document it.
- Add `docs/CMS.md` covering: how to add a post, how to add a bottle, how to add an affiliate link, and what happens after saving (commit → Amplify build → live in ~90s).

## 12. Build order

**Phase 1** — `pnpm install`, verify the build runs clean, then base layout, header, and footer against the existing tokens. Stop and show me.
**Phase 2** — Content collections + schemas, MDX components, article template, article index. Stop.
**Phase 3** — Bottle collection, product card, `/best-bottles` hub, individual bottle pages, affiliate registry + `<AffiliateLink>` + redirect generation. Stop.
**Phase 4** — Homepage assembled from all sections. Stop.
**Phase 5** — SEO layer, JSON-LD, OG images, sitemap, RSS, analytics, newsletter form. Stop.
**Phase 6** — Keystatic admin (§11a), local mode working end to end, `docs/CMS.md`. Stop.
**Phase 7** — Legal pages, seed content written, `amplify.yml`, `README.md`, `docs/DEPLOY.md`, `docs/CMS.md`, `.env.example`. Final Lighthouse pass and report the scores.

---

## 13. Conventions

- Small, composable components in `src/components/`, grouped by domain (`layout/`, `content/`, `product/`, `seo/`)
- No component over ~150 lines
- Every exported function typed, no `any`
- Conventional commits, one commit per phase
- Add a `CLAUDE.md` at the repo root documenting the brand tokens, content model, affiliate link rule, and voice rules so future sessions stay consistent
- Run `astro check` and fix all errors before declaring a phase complete

Start with Phase 1.
