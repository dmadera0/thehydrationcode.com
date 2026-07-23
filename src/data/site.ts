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
    // PMC mirror, not the pnas.org DOI page — same paper, freely readable.
    // The article on this same claim links the identical PMC record.
    source: 'PNAS, 2024',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10801917/',
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
    // Cheuvront & Kenefick (2014, Comprehensive Physiology) is the paper
    // usually cited for this, but it's paywalled — we could never confirm it
    // ourselves. James et al. (2019, Sports Medicine) states the identical
    // ≥2% finding in its own text (confirmed by direct fetch) and is free to
    // read via PMC, so that's the source actually named and linked here.
    source: 'James et al., Sports Medicine, 2019',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6901416/',
    verified: true,
  },
  {
    value: '9%',
    label: 'of plastic waste is recycled globally',
    // Corrected from "<10% ... into new bottles": OECD's figure is for all
    // plastic waste, not bottle-to-bottle recycling specifically — that
    // narrower claim isn't what the source actually measured. Linked directly
    // to the OECD PDF itself (extracted and confirmed via pdftotext after
    // oecd.org blocked automated fetches), not the trade-press writeup that
    // reported on it.
    source: 'OECD, 2022',
    url: 'https://www.oecd.org/content/dam/oecd/en/publications/support-materials/2022/02/global-plastics-outlook_a653d1c9/Global%20Plastics%20Outlook%20I.pdf',
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
