// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

/**
 * Keystatic is build-time optional. Production builds (KEYSTATIC_ENABLED
 * unset or not 'true') must never load @astrojs/node, @astrojs/react, or
 * @keystatic/astro at all — not just skip using them. That's why these are
 * dynamic imports gated behind the flag rather than static ones at the top
 * of the file: a static import always executes regardless of any runtime
 * condition around its usage, which would still pull the adapter and inject
 * the /keystatic routes into every build.
 *
 * When the flag is off: output is pure static to dist/, no adapter, no
 * server, exactly as it was through Phase 5. When it's on: /keystatic and
 * /api/keystatic become on-demand routes and everything else stays
 * prerendered — see docs/CMS.md for the full explanation and the pinned
 * dependency versions this depends on.
 */
const keystaticEnabled = process.env.KEYSTATIC_ENABLED === 'true';

const integrations = [
  mdx(),
  sitemap({
    // /go/* are affiliate redirects. They must never be indexed.
    filter: (page) => !page.includes('/go/'),
  }),
];

let adapter;

if (keystaticEnabled) {
  const [{ default: react }, { default: keystatic }, { default: node }] = await Promise.all([
    import('@astrojs/react'),
    import('@keystatic/astro'),
    import('@astrojs/node'),
  ]);
  integrations.push(react(), keystatic());
  adapter = node({ mode: 'standalone' });
}

export default defineConfig({
  site: 'https://thehydrationcode.com',
  output: 'static',
  trailingSlash: 'never',

  ...(adapter ? { adapter } : {}),

  integrations,

  vite: {
    plugins: [tailwindcss()],
  },

  image: {
    // Local images run through sharp at build time.
    // Remote patterns stay empty on purpose: we do not hotlink merchant images.
    remotePatterns: [],
  },

  markdown: {
    shikiConfig: { theme: 'github-light', wrap: true },
  },

  build: {
    inlineStylesheets: 'auto',
  },
});
