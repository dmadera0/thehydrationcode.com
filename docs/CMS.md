# CMS (Keystatic)

The admin lives at `/keystatic` when running `pnpm dev`. It edits the same
files you'd otherwise hand-edit in `src/content/`, `src/data/affiliates/`,
and `src/data/site-settings.json` — there's no separate database. Saving in
the UI writes real files to your working tree, exactly like editing them in
a text editor would.

## Turning it on

Keystatic is build-time optional, gated on `KEYSTATIC_ENABLED` (see
`.env.example`). Unset or anything other than the literal string `'true'`:
`astro.config.mjs` never even loads `@astrojs/node`, `@astrojs/react`, or
`@keystatic/astro` — production builds are pure static output to `dist/`,
no adapter, no server, no `/keystatic` route, indistinguishable from before
this CMS existed. Set `KEYSTATIC_ENABLED=true` in your local `.env` to use
the admin with `pnpm dev`. Nothing about deploying the admin is decided by
this flag alone — see "GitHub mode setup" below for what turning it on in
production would actually require.

**Hard rule 7 (CLAUDE.md) applies here exactly as it does to hand-edited
files: a citation must link the actual source it names, and that source must
be readable without payment.** The CMS does not relax this. It cannot check
whether a URL you paste into a Source's "URL" field is the real authority's
own page rather than a blog reporting on it — that verification is still on
whoever is entering the content. A wrong or lazily-sourced citation entered
through a nice UI is exactly as much a problem as one hand-typed into a
`.mdx` file.

## Adding a post

1. `pnpm dev`, go to `/keystatic` → **Posts** → the `+` button.
2. Fill in Title (the slug auto-derives from it — check it before saving;
   changing the title later does *not* rename the file, so get the slug
   right on the first save if the URL matters).
3. Dek, Pillar, Published date, Hero image (uploads to
   `src/assets/images/posts/`), Hero image alt text.
4. **Sources** — add at least one. Every field matters: `label` is what
   readers see under a stat or next to a citation number, `url` is what hard
   rule 7 is about. Don't paste a news write-up's URL when the study itself
   is findable — see the fixes in the phase 4/5 commit history for what
   "wrong" looks like here in practice (a trade-press link where the actual
   authority's own page was findable, a paywalled paper where an open PMC
   mirror existed).
5. Body: write MDX as usual. `Citation`, `StatBlock`, `Callout`,
   `ComparisonTable`, and `KeyTakeaways` are all insertable from the `+` menu
   in the toolbar — you don't need to (and can't) write an `import`
   statement; Keystatic statically analyzes the MDX and registers these as
   the same components `src/components/content/mdx.ts` already exposes to
   hand-written files.
6. FAQ and Related bottles are optional, same rules as the Zod schema.
7. Click **Create**. If you leave `draft` checked, the post exists but is
   excluded from production builds (`getPublishedPosts()` filters on it) —
   useful for writing over several sessions.

## Adding a bottle

1. `/keystatic` → **Bottles** → `+`.
2. `priceDisplay` defaults to `hidden` — **leave it there for any Amazon
   affiliate link.** Amazon's Operating Agreement forbids displaying a price
   that isn't sourced from the Product Advertising API and refreshed within
   24h (`src/lib/pricing.ts`, CLAUDE.md hard rule 3). The CMS does not stop
   you from setting `range` or `exact` on an Amazon-linked bottle — that
   check happens in `resolvePrice()` at render time, which hard-gates
   `network: 'amazon'` to hidden regardless of what this field says. But
   don't rely on that backstop; set it correctly here.
3. `affiliateId` is a relationship field — pick from the Affiliates
   collection rather than typing an id, so a typo can't silently produce a
   dead link.
4. **Pros / Cons**: the form enforces a minimum of two cons the same as the
   Zod schema does. If you can't think of two real ones, you don't know the
   product well enough to publish the review (CLAUDE.md hard rule 5).
5. Product image uploads to `src/assets/images/bottles/`.

## Adding an affiliate link

1. `/keystatic` → **Affiliates** → `+`.
2. `label` becomes the entry's id/filename (via the slug field) — this is
   what `affiliateId` fields elsewhere reference and what `/go/{id}`
   resolves. Get it right before saving; renaming later doesn't update
   existing references automatically.
3. `network`, `url` (the one place in the whole codebase a raw merchant URL
   is allowed — enforced by `scripts/check-affiliate-links.mjs`, which runs
   on every build regardless of whether the entry came from the CMS or a
   hand-edit), `merchant`, and `active`.
4. Nothing renders this URL directly. Every bottle card and detail page goes
   through `<AffiliateLink>`, which always points at the cloaked `/go/{id}`
   path with `rel="sponsored nofollow noopener"` — that's unaffected by
   where the registry entry came from.

## Editing Site Settings

`/keystatic` → **Site Settings**. This is the homepage hero copy, footer
promise/disclosure text, and the four-stat homepage band.

The stat band is the one place where "hard rule 7 applies to the CMS too" is
most likely to actually matter day to day: it's tempting to update a number
without re-checking the link. Don't. Each stat's `verified` checkbox exists
specifically to make it visible when a figure hasn't been re-confirmed — the
field description says not to check it until you've directly confirmed the
figure and the URL yourself. Shipping `verified: true` on a stat you didn't
actually check is worse than leaving it unchecked.

## What happens after you save

**Local mode (current, default):** saving in the Keystatic UI writes the
file(s) directly into your working tree — the same as `git status` would
show after any manual edit. Nothing is committed automatically. You still
`git add`, commit, and push yourself. Once pushed to the branch Amplify
watches: Amplify detects the push → runs `pnpm build` per `amplify.yml` →
deploys → live in roughly 90 seconds.

**GitHub mode (configured, not deployed — see below):** saving in the UI
commits directly to the repo via the GitHub API (no local working tree
involved at all), which then triggers the same Amplify build/deploy.

## GitHub mode setup (not deployed yet)

GitHub mode lets the CMS be used against the *deployed* site (e.g. from a
phone, or by someone without the repo cloned locally) instead of only
against a local working tree. It needs a GitHub App and, critically, a
server to run on — Keystatic's GitHub mode injects an OAuth-callback and
API-proxy route that must handle requests at runtime, not at build time.
That's the whole reason `@astrojs/node` exists in this project at all — it's
only ever loaded when `KEYSTATIC_ENABLED=true` (see "Turning it on" above
and the comment at the top of `astro.config.mjs`); the public site itself is
100% static output either way.

**This is wired but intentionally not turned on.** `KEYSTATIC_STORAGE` is
unset in `.env.example`, so `keystatic.config.ts` falls back to `local`
mode. Flipping it on for real also means updating the Amplify deployment —
see the note below — which is a separate decision.

To actually enable it later:

1. **Create a GitHub App** (not an OAuth App — Keystatic specifically wants
   a GitHub App): github.com/settings/apps/new, under your account or the
   org that owns this repo.
   - Homepage URL: `https://thehydrationcode.com`
   - Callback URL: `https://thehydrationcode.com/api/keystatic/github/oauth/callback`
   - Webhook: disable (not needed)
   - Permissions: Repository → Contents: Read & write, Metadata: Read-only
   - Where can this app be installed: "Only on this account"
2. **Install the app** on the `thehydrationcode.com` repo specifically.
3. Generate a client secret for the app.
4. Set these in Amplify's environment variables (never commit them):
   - `KEYSTATIC_STORAGE=github`
   - `KEYSTATIC_GITHUB_CLIENT_ID` — the App's client ID
   - `KEYSTATIC_GITHUB_CLIENT_SECRET` — the generated secret
   - `KEYSTATIC_SECRET` — a random string (`openssl rand -hex 32`), used to
     sign the session cookie
5. Update `keystatic.config.ts`'s `github.repo.owner` / `.name` (currently
   `'REPLACE_ME'` placeholders) to the actual GitHub org/user and repo name.
6. **Set `KEYSTATIC_ENABLED=true` in Amplify's environment variables.** Only
   then does `astro.config.mjs` load the adapter at all, which is also only
   then that the build output shape changes from `dist/` to `dist/client/` +
   `dist/server/`. At that point `amplify.yml`'s `baseDirectory: dist` does
   need to become `baseDirectory: dist/client`, plus a compute/SSR
   configuration for the `/keystatic` and `/api/keystatic` routes
   specifically. Until `KEYSTATIC_ENABLED` is actually set to `true`
   somewhere it matters (i.e. in Amplify, not just locally), none of this
   applies — `amplify.yml` stays correct as-is.

## Dependency pins — do not casually bump these

`vite@6.4.3`, `@astrojs/node@9.5.5`, `@astrojs/react@4.3.0`, `react-aria`,
`react-stately`, and `@keystar/ui` are all pinned deliberately, together,
against Astro 5.18.2. The latest versions of the Astro integrations
(`@astrojs/node@11`, `@astrojs/react@6`) require Astro 6/7 and pull in a
newer Vite line than Astro 5 ships, which silently breaks `astro check` via
a duplicate-Vite-version type conflict — not an error that points at the
real cause. `react-aria` and `react-stately` are marked as optional peers of
`@keystatic/core` but its bundled admin UI imports from them
unconditionally regardless; the build fails without them actually
installed, at an exact pinned version @keystatic/core expects.

**Upgrading Astro means revisiting all six of these together, deliberately,
not just running `pnpm update`.** Whoever hits a version-conflict build
failure here in six months will have no reason to suspect Keystatic is the
cause unless this paragraph exists.
