// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://thehydrationcode.com',
  output: 'static',
  trailingSlash: 'never',

  // Keystatic injects /keystatic and /api/keystatic with prerender: false —
  // an on-demand admin route, nothing else. Every other page has no
  // prerender override, so output: 'static' keeps prerendering them at
  // build time exactly as before. The adapter is only here to give those
  // two routes somewhere to run; it does not change how the rest of the
  // site builds or deploys.
  adapter: node({ mode: 'standalone' }),

  integrations: [
    mdx(),
    react(),
    keystatic(),
    sitemap({
      // /go/* are affiliate redirects. They must never be indexed.
      filter: (page) => !page.includes('/go/'),
    }),
  ],

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
