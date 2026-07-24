/**
 * Sitewide constants. Copy that appears in more than one place lives here.
 *
 * The CMS-editable parts (hero copy, footer text, the stat band) live in
 * site-settings.json, which Keystatic manages as the "Site Settings"
 * singleton (see keystatic.config.ts). Everything else here — name, url,
 * nav structure, logo path — is a code decision, not content, so it stays
 * a plain constant a CMS user can't touch.
 */
import settings from './site-settings.json';

export const SITE = {
  name: 'The Hydration Code',
  tagline: 'Drink smarter',
  url: 'https://thehydrationcode.com',
  description:
    'Research-backed breakdowns of microplastics, plastic leaching, and the glass bottles worth trusting. Every claim cited.',
  promise: settings.footer.promise,
  /** Raster logo for JSON-LD (Organization.logo, Article.publisher.logo).
   * Google requires a raster format here — SVG errors in Search Console. */
  logoPath: '/logo-600x60.png',
} as const;

export interface HeroStat {
  value: string;
  label: string;
  source: string;
  url: string;
  verified: boolean;
}

/**
 * Homepage stat band.
 * EVERY FIGURE HERE MUST BE VERIFIED BEFORE LAUNCH. The entire positioning of
 * this site is "every claim cited" — one wrong headline number is fatal.
 * Hard rule 7 (CLAUDE.md) applies here same as anywhere: the linked url must
 * be the actual authority's own page, readable without payment — including
 * when this is edited through Keystatic, not just by hand.
 */
export const HERO_STATS: HeroStat[] = settings.heroStats;

export const HERO_COPY = settings.hero;

export const NAV = [
  { label: 'Home', href: '/' },
  { label: 'The Research', href: '/research' },
  { label: 'Best Bottles', href: '/best-bottles' },
  { label: 'Our Method', href: '/our-method' },
] as const;

export const AFFILIATE_DISCLOSURE_SHORT = settings.footer.disclosure;
