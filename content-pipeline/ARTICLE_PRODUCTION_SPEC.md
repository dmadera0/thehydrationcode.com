# The Hydration Code — Article Production Spec

A complete specification for creating, structuring, sourcing, and publishing a
blog article. Written for an automated agent. Follow it exactly; the build
enforces most of it and will reject non-compliant files rather than shipping
them.

**Before relying on this document, verify it against two files in the repo,
which are the real source of truth:**
- `src/content.config.ts` — the Zod schema every article is validated against
- Any existing file in `src/content/posts/` — a working example of the shape

If this document and those files disagree, the files win. Report the drift.

---

## 0. The one rule that overrides everything

**Never publish a factual claim without a real, verifiable source.**

This site's entire value is citation accuracy. A single fabricated study,
invented statistic, wrong author, or dead link is the failure that ends the
brand's credibility. Concretely:

- Every factual claim must trace to a source listed in the article's
  frontmatter `sources` array.
- Before citing a source, fetch the URL and confirm the specific claim actually
  appears in that page's text. "It's probably right" is not verification.
- The cited URL must be readable without payment. If the primary source is
  paywalled, link an open mirror (PubMed Central, the author's copy, the
  issuing body's own PDF) or cite a different source you can actually read.
- Link the authority that made the claim, not a news article reporting on it.
  If OECD said it, link OECD — not a blog quoting OECD.
- If a claim cannot be verified to this standard, do ONE of: cut the claim,
  soften it to what the evidence supports, or insert the literal marker
  `{/* NEEDS SOURCE */}` next to it and leave it for human review. Never invent
  a citation to fill the gap.
- Prefer primary sources: peer-reviewed studies, government data, standards
  bodies. Avoid content mills, SEO blogs, and affiliate competitors.

Treat "correct but unverifiable" as unsourced.

---

## 1. Where a post lives

A single article is **two files**:

1. The article — one `.mdx` file in `src/content/posts/`
2. Its hero image — one image file in `src/assets/images/posts/`

The `.mdx` frontmatter references the image by relative path. Adding the `.mdx`
without its image will fail the build. Both files are required.

The `src/content/posts/` folder is the single source of truth for all blog
content. The research index, the three pillar hub pages, and the RSS feed all
generate from it automatically. Never edit those pages directly — add, edit, or
remove a file in `posts/` and everything downstream updates itself.

---

## 2. The filename IS the URL

`src/content/posts/glass-vs-stainless-steel.mdx`
becomes
`https://thehydrationcode.com/research/glass-vs-stainless-steel`

Rules for the filename:
- lowercase, words separated by hyphens, no spaces, no underscores
- descriptive and keyword-relevant (it's the URL slug and an SEO signal)
- **never rename after publishing** — once Google indexes the URL, renaming
  breaks the link and forfeits any ranking. To change a title, change the
  `title` field, not the filename.

---

## 3. Frontmatter — exact schema

Every `.mdx` file opens with a frontmatter block between `---` fences. This is
validated by Zod at build time. A missing required field, a wrong type, or an
out-of-range value fails the build.

```mdx
---
title: "Glass vs. Stainless Steel: Which Bottle Is Actually Better?"
dek: "Both beat plastic, but they are not equal. We compared taste, safety, durability, and lifecycle cost to find the right bottle for each use case."
pillar: "why-glass-matters"
publishedAt: 2026-07-24
updatedAt: 2026-07-24
heroImage: "../../assets/images/posts/glass-vs-stainless-steel.jpg"
heroAlt: "A clear glass water bottle beside a stainless steel bottle on a light surface"
featured: false
draft: false
sources:
  - label: "PNAS, 2024"
    title: "Rapid single-particle chemical imaging of nanoplastics by SRS microscopy"
    publisher: "Proceedings of the National Academy of Sciences"
    year: 2024
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10801917/"
    doi: "10.1073/pnas.2300582121"
faq:
  - q: "Is glass or stainless steel better for hot drinks?"
    a: "Stainless steel, if it is insulated. Glass holds no temperature and can crack under thermal shock."
relatedBottles: []
---
```

### Field reference

| Field | Required | Type / rule | Notes |
|---|---|---|---|
| `title` | yes | string, ≤70 chars | Keep under 70 so it isn't truncated in Google results. |
| `dek` | yes | string, 50–165 chars | 1–2 sentence summary. Doubles as the card blurb AND the meta description. Write it to earn a click from a search result. |
| `pillar` | yes | enum, EXACT | One of: `science-of-plastic`, `why-glass-matters`, `health-optimization`. Any other value fails the build. |
| `publishedAt` | yes | date `YYYY-MM-DD` | Original publish date. Do not change it on later edits. |
| `updatedAt` | no | date `YYYY-MM-DD` | Set when meaningfully revising a published post. Feeds `dateModified` in structured data. |
| `heroImage` | yes | image path | Relative path into `src/assets/images/posts/`. The file must exist. |
| `heroAlt` | yes | string, ≥10 chars | Real description of the image, for accessibility and SEO. Not the title. |
| `featured` | no | boolean, default false | `true` surfaces it in the homepage featured-research row. Keep few featured. |
| `draft` | no | boolean, default false | `true` builds locally but is excluded from the production site. Use for work in progress. |
| `sources` | yes | array, ≥1 entry | The article's citations. Schema below. An empty array fails the build. |
| `faq` | no | array of `{q, a}` | Renders an FAQ section AND emits FAQPage structured data (rich-result eligible). Use real questions a reader would search. |
| `relatedBottles` | no | array of bottle refs | Product references. Products are currently hidden site-wide via the `PRODUCTS_ENABLED` flag, so leave this `[]` for now. It renders as a plain internal link when products are on. |

### Source entry schema

Every object in `sources` requires:

| Key | Required | Notes |
|---|---|---|
| `label` | yes | Short inline form, e.g. `"PNAS, 2024"`. This is what shows in the body citation. |
| `title` | yes | Full title of the study or document. |
| `publisher` | yes | Journal, agency, or standards body. |
| `year` | yes | Integer, 1900–2100. |
| `url` | yes | Direct, free-to-access URL. Must resolve and must contain the claim. |
| `doi` | no | Include when one exists. Leave out entirely rather than guessing. |

---

## 4. Body structure

Below the frontmatter is the article in MDX (Markdown plus the custom
components in section 5). Target **1,200+ words** for a substantive research
piece. Structure to be scannable, quotable, and genuinely useful — not padded
for length.

Recommended shape (adapt to the topic, don't follow mechanically):

1. **Opening (2–3 short paragraphs).** State the question and why it matters.
   Lead with the strongest cited fact. No throat-clearing, no "in today's
   world." Give the reader a reason to keep reading in the first two sentences.
2. **`<KeyTakeaways>` block** near the top for any article over ~1,000 words —
   the 3–5 bullet answer for skimmers.
3. **Body sections under `##` (H2) headings.** One idea per section. Every
   factual claim carries a `<Citation>` to a source in the frontmatter. Use
   `<StatBlock>` to feature a single striking number, `<Callout>` for a
   caveat, warning, or key point
   (including honest limitations of a cited study — acknowledging a study's
   critique makes the article MORE credible, not less).
4. **Nuance / counterpoint section.** Where the evidence is contested or the
   popular claim overreaches, say so plainly. This is a differentiator: most
   competing content is one-sided.
5. **Practical takeaway.** What the reader should actually do.
6. **FAQ** (optional, via frontmatter `faq`) for common follow-up questions.
   Rich-result eligible, so worth including.

The `<SourceList>` (numbered references) renders automatically at the end from
frontmatter — do NOT hand-write a references section.

### Heading rules
- Exactly one H1 per page — it is generated from `title`. **Never put an `#` H1
  in the body.** Start body headings at `##` (H2).
- Don't skip levels (no H2 straight to H4).
- Headings are content, not decoration — write them to be informative.

### Voice
- Trusted researcher, not salesperson. Authoritative but conversational.
- Every claim carries a source name and year.
- No hype adjectives, no exclamation marks, no corporate speak.
- Write lines a reader would screenshot or quote.
- Never imply the site manufactures, owns, or sells any product.
- Buttons and links say what happens ("Read the research", not "Learn more").

---

## 5. Custom MDX components

These are available in any `.mdx` body without importing them (registered
centrally). Use them; don't reinvent them with raw HTML. **Verify the exact
prop names against `src/components/content/` and `src/components/content/mdx.ts`
in the repo before use — treat the following as the intended interface, not a
substitute for the real component signatures.**

- `<Citation id="..." />` — inline superscript reference. The `id` maps to a
  source in frontmatter (by label or index — confirm the convention in the
  existing article). This is the site's signature element: it's how a claim
  visibly ties to its source. Every non-obvious factual claim gets one.
- `<SourceList />` — the numbered reference list. Rendered automatically at
  article end from frontmatter `sources`. Do not place manually.
- `<StatBlock ... />` — large numeral + label + small-caps source line. For
  featuring one striking figure. The source shows as an attribution, linked to
  the numbered source rather than carrying a raw external URL in the body.
- `<Callout>` — boxed aside. Variants: `note`, `warning`, `key`. Use for
  caveats, limitations, and important context.
- `<KeyTakeaways>` — bulleted summary box for the top of long articles.

Constraint: components must not introduce client-side JavaScript. Keep articles
zero-JS.

---

## 6. The hero image

- Place the file in `src/assets/images/posts/`, named to match the article
  slug (e.g. `glass-vs-stainless-steel.jpg`).
- Reference it from frontmatter `heroImage` by relative path.
- Provide meaningful `heroAlt`.
- Landscape, roughly 1200×900 or larger; smaller images upscale and blur.
- **Commercially licensed.** This is a monetized site. Use only images cleared
  for commercial use (e.g. Unsplash/Pexels license, or properly licensed/AI
  imagery). Never hotlink; the file must live in the repo so Astro's `<Image />`
  pipeline can optimize it to WebP at build. Never reference a remote image URL.
- On-brand: clean, editorial, natural light; glass/water/lab/lifestyle. No
  identifiable real person's face (the brand is faceless). No competitor
  branding.

---

## 7. Pre-publish validation — the agent MUST pass all of these

Run locally before committing. Do not push a build you have not run.

1. `pnpm check` → must report 0 errors, 0 warnings, 0 hints, AND
   "No schema drift" AND "Affiliate link guard passed".
2. `pnpm build` → must complete with no errors. The new article's route must
   appear in the build output.
3. **Source audit:** for every entry in `sources`, fetch the URL and confirm
   the specific claim it supports appears on that page and the page is not
   paywalled. Any failure → fix the citation or mark `{/* NEEDS SOURCE */}`.
4. **No affiliate/merchant URL anywhere in the body.** The affiliate guard
   enforces this and fails the build on any external merchant link in
   `src/content/`. Citations in frontmatter `sources` are the only permitted
   external links, and they must be genuine sources, not merchants.
5. **Slug is final** and not a rename of an existing published URL.
6. **Pillar is one of the three exact values.**
7. **Hero image file exists** at the referenced path and is committed.
8. `title` ≤70 chars; `dek` 50–165 chars.
9. Exactly one H1 (auto from title); body starts at H2.

---

## 8. Publish workflow

```bash
# 1. Start from a current repo
cd <repo root>
git pull

# 2. Create the two files:
#    src/content/posts/<slug>.mdx
#    src/assets/images/posts/<slug>.jpg
#    (easiest: copy an existing post as a template, replace contents)

# 3. Preview while writing (live-reloads)
pnpm dev            # http://localhost:4321/research/<slug>

# 4. Validate — both must pass clean
pnpm check
pnpm build

# 5. Commit and push
git add -A
git commit -m "post: <short description>"
git push
```

On push, AWS Amplify auto-builds and deploys in ~2–4 minutes
(Provision → Build → Deploy → Verify). The article is then live at
`/research/<slug>`, listed on `/research`, on its pillar hub, and in
`/rss.xml`. Hard-refresh (Cmd/Ctrl+Shift+R) to bypass the CDN cache.

If the Amplify build fails after a local build passed, the usual cause is an
environment mismatch, not the article — check the Amplify build log. Do not
weaken any check or guard to force a build through.

---

## 9. Editing or removing an existing post

- **Edit:** change the `.mdx` file. Set `updatedAt` to today when the change is
  substantive. Do not change the filename. Re-run section 7 validation. Commit
  and push.
- **Unpublish quietly:** set `draft: true` — it drops from the production site
  but stays in the repo.
- **Remove:** delete the `.mdx` file (and its image). It disappears from the
  index, pillar hub, and feed on the next build. Note: if the URL was indexed,
  removing it creates a 404 — prefer `draft: true` unless a permanent removal
  with a redirect is intended.

---

## 10. Hard constraints (never violate)

- No fabricated or unverifiable citations. (Section 0.)
- No client-side JavaScript introduced by an article.
- No merchant/affiliate URLs in the article body.
- No hardcoded color hex values; the components already carry the design
  tokens.
- One H1 per page, generated from the title.
- Filenames of published posts are immutable.
- Every source URL free to access and containing the claim it's cited for.
- The three pillar values are fixed; do not invent a new pillar without a
  corresponding code change (which is out of scope for content work).
- Never use `<ComparisonTable>`. It is not supported in auto-drafted articles
  — the component's required props are commonly omitted by the drafting
  model, which breaks the build. Use `<StatBlock>` or a plain markdown table
  for any head-to-head material instead.

---

## Quick reference — minimum viable new post

1. Copy an existing `src/content/posts/*.mdx` to `src/content/posts/<new-slug>.mdx`.
2. Add a commercially-licensed hero image at
   `src/assets/images/posts/<new-slug>.jpg`.
3. Fill frontmatter: `title`, `dek`, `pillar` (one of three), `publishedAt`,
   `heroImage`, `heroAlt`, and at least one verified `sources` entry.
4. Write 1,200+ words, H2 sections, `<Citation>` on every factual claim, sources
   verified by fetching each URL.
5. `pnpm check` and `pnpm build` — both clean.
6. Audit every source URL. Mark unverifiable claims `{/* NEEDS SOURCE */}`.
7. `git add -A && git commit && git push`. Live in ~3 minutes.
