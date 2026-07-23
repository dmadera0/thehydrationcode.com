// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://thehydrationcode.com',
  output: 'static',
  trailingSlash: 'never',

  integrations: [
    mdx(),
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
