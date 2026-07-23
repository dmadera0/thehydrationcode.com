/** Sitewide constants. Copy that appears in more than one place lives here. */

export const SITE = {
  name: 'The Hydration Code',
  tagline: 'Drink smarter',
  url: 'https://thehydrationcode.com',
  description:
    'Research-backed breakdowns of microplastics, plastic leaching, and the glass bottles worth trusting. Every claim cited.',
  promise:
    'The facts and tools to make better hydration choices—so you can trust what you\u2019re drinking and share that confidence with others.',
} as const;

/**
 * Homepage stat band.
 * EVERY FIGURE HERE MUST BE VERIFIED BEFORE LAUNCH. The entire positioning of
 * this site is "every claim cited" — one wrong headline number is fatal.
 */
export const HERO_STATS = [
  {
    value: '240,000',
    label: 'plastic particles per liter of bottled water',
    source: 'PNAS, 2024',
    url: 'https://www.pnas.org/doi/10.1073/pnas.2300582121',
    verified: true,
  },
  {
    value: '90%',
    label: 'of bottled water samples contained microplastics',
    source: 'WHO review',
    url: '',
    // TODO: VERIFY. This figure traces to Orb Media (2018), which reported 93%
    // across 259 bottles, not 90%, and WHO reviewed rather than produced it.
    // Fix the number and the attribution or cut the stat.
    verified: false,
  },
  {
    value: '2%',
    label: 'body-water loss that measurably impairs performance',
    source: 'Sports Med',
    url: '',
    // TODO: VERIFY. Well supported in the literature but needs a specific
    // citation — journal, authors, year — not a bare journal name.
    verified: false,
  },
  {
    value: '<10%',
    label: 'of plastic bottles are recycled into new bottles',
    source: 'OECD',
    url: '',
    // TODO: VERIFY. OECD Global Plastics Outlook reports ~9% of all plastic
    // recycled; bottle-to-bottle specifically is a different figure. Confirm
    // which claim we are actually making.
    verified: false,
  },
] as const;

export const NAV = [
  { label: 'Home', href: '/' },
  { label: 'The Research', href: '/research' },
  { label: 'Best Bottles', href: '/best-bottles' },
  { label: 'Our Method', href: '/our-method' },
] as const;

export const AFFILIATE_DISCLOSURE_SHORT =
  'We earn a commission when you buy through our links, at no extra cost to you. We only recommend products we believe are genuinely better, based on our research.';
