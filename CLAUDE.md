# CLAUDE.md — The Hydration Code

Read this before writing any code. The full build brief is in `docs/PROJECT_SPEC.md`.

## What this is

A faceless, SEO-first affiliate content site about microplastics and glass water bottles. It is a **content authority**, not a store. Revenue comes from affiliate commissions. There is no founder persona, no author photos, no on-camera brand.

Static Astro. Deployed to AWS Amplify. Content lives in git as markdown.

## Design thesis

The signature of this site is **visible sourcing**. Citations are not footnote clutter to be hidden — they are the product. Every stat carries its source in small-caps beneath it, every article ends in a numbered source list, and inline citations render as tappable superscripts that scroll to the source. If a design decision makes sourcing less visible, it is the wrong decision.

Everything else stays quiet: high whitespace, editorial rhythm, no gradients, no glassmorphism, no decorative illustration, no scattered scroll animations. Spend the boldness on the green data bands and the citation treatment. Nothing else competes.

## Design tokens

Defined once in `src/styles/global.css` under `@theme`. **Never hardcode a hex value in a component.** Use Tailwind classes generated from the tokens (`bg-brand`, `text-body`, `border-line`).

| Token | Value | Use |
|---|---|---|
| `--color-brand` | `#1A6B4D` | Primary. CTAs, data bands, logo. |
| `--color-brand-dark` | `#124F39` | Hover / pressed. |
| `--color-brand-tint` | `#E8F0EC` | Pale section backgrounds. |
| `--color-accent` | `#0066CC` | Links, badges, data viz. **Sparingly.** |
| `--color-ink` | `#1A1A1A` | Headings. |
| `--color-body` | `#4A4A4A` | Body copy. |
| `--color-surface` | `#FFFFFF` | Cards, page background. |
| `--color-line` | `#E5E7EB` | Borders, dividers. |

Type: Montserrat Variable for display (600/700, tight tracking), Inter Variable for body (400/500, line-height 1.65, 16px floor). Both self-hosted via `@fontsource-variable` — **no Google Fonts CDN requests**.

Radius: 8px on cards, 12px on panels and images. Soft 1px borders instead of shadows. Shadows only on the sticky header when scrolled.

## Voice rules — apply to every string you write

- Trusted researcher, not salesperson. Authoritative but conversational.
- Every factual claim carries a source name and year. No exceptions.
- No hype adjectives, no exclamation marks, no corporate speak.
- Write lines people screenshot.
- Never imply we manufacture, own, or sell any product.
- Buttons say what happens: "Read the research", not "Learn more".

## Hard rules

1. **No fabricated citations.** If a claim needs a source you cannot verify, write the claim and leave `{/* NEEDS SOURCE */}` next to it. Never invent a study, DOI, author, or statistic. This is the one failure that would end the site.
2. **All affiliate links go through `<AffiliateLink>`.** No raw merchant URLs anywhere else in the codebase. Every one gets `rel="sponsored nofollow noopener"` and `target="_blank"`.
3. **Never display an Amazon price.** Amazon's Operating Agreement forbids it unless the price comes from the Product Advertising API and refreshes within 24 hours, and PA-API access requires three qualifying sales first. Amazon products render "Check price ↗". See `src/lib/pricing.ts`.
4. **Affiliate disclosure appears above the first affiliate link on any page that has one.** Footer and dedicated page too. FTC requires it be unavoidable.
5. **Every bottle lists real cons.** Minimum two. A review with no downsides is an advertisement and readers know it.
6. **No browser storage APIs** and no client-side JS unless a component genuinely needs it. Ship zero JS by default.
7. **A citation must link to the source it names, and that source must be readable without payment.** If the authority you're attributing to (OECD, WHO, a journal) has published the claim itself, link that — never a news article or blog reporting on it. If the primary source is paywalled, link an open mirror (PMC, the author's copy, the issuing body's own PDF) or cite a different source you can actually read. Correct-but-unverifiable is treated as unsourced.

## Conventions

- TypeScript strict. No `any`. Every export typed.
- Components grouped by domain in `src/components/{layout,content,product,seo}/`. None over ~150 lines.
- Content schemas live in `src/content.config.ts` and are the single source of truth. Keystatic's schema mirrors them — if you change one, change both.
- Run `pnpm astro check` and fix all errors before declaring a phase complete.
- Conventional commits, one per phase.
- Images always have explicit dimensions. Zero CLS is a requirement, not a goal.
- Accessibility floor: visible keyboard focus, `prefers-reduced-motion` respected, semantic headings, one H1 per page.

## Build phases

Work through `docs/PROJECT_SPEC.md` §12 in order. **Stop at the end of each phase** and summarize what was built and what is next. Do not scaffold ahead.

## What already exists

Phase 0 is done. Config, tokens, content schemas, the affiliate registry, and the `/go/[id]` redirect route are in place. Start at Phase 1 (layout, header, footer) and build on what's here rather than regenerating it.
