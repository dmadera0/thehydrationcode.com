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
    value: '93%',
    label: 'of bottled water samples tested showed microplastic contamination',
    // Corrected from an earlier "90% — WHO review" version: WHO never
    // produced a contamination-rate figure. The real number traces to Mason,
    // Welch & Neratko (2018), confirmed by direct fetch of the paper itself.
    source: 'Frontiers in Chemistry, 2018',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6141690/',
    verified: true,
  },
  {
    value: '2%',
    label: 'body-water loss that measurably impairs endurance performance',
    source: 'Cheuvront & Kenefick, Comprehensive Physiology, 2014',
    url: 'https://doi.org/10.1002/cphy.c130017',
    verified: true,
  },
  {
    value: '9%',
    label: 'of plastic waste is recycled globally',
    // Corrected from "<10% ... into new bottles": OECD's figure is for all
    // plastic waste, not bottle-to-bottle recycling specifically — that
    // narrower claim isn't what the source actually measured.
    source: 'OECD, 2022',
    url: 'https://www.circularonline.co.uk/news/9-of-global-plastic-waste-is-recycled-while-22-is-mismanaged-oecd/',
    verified: true,
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
