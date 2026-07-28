/**
 * Build-time feature flags. Read import.meta.env exactly once, here — every
 * other file imports the typed constant instead of touching
 * import.meta.env.* directly, so there's one place to check when a flag's
 * behavior needs to change.
 */

/**
 * Best Bottles / product section: routes, nav links, the homepage product
 * section, and the footer disclosure block all key off this. Defaults to
 * false (hidden) — see .env.example and README.md's "Feature flags" section.
 */
/**
 * process.env, not import.meta.env: this flag is only ever read from
 * frontmatter/build-time code (never shipped to the client), and Vite only
 * statically injects PUBLIC_-prefixed vars into import.meta.env — an
 * unprefixed var like this one would silently read as undefined there. Same
 * reason KEYSTATIC_ENABLED uses process.env in astro.config.mjs.
 */
export const PRODUCTS_ENABLED = process.env.PRODUCTS_ENABLED === 'true';
