/**
 * Content pillars. The taxonomy used across posts, nav, and the /research
 * hub pages. Lives outside content.config.ts so runtime components (Footer,
 * pillar pages) never need to import the content config module.
 */
export const PILLARS = [
  'science-of-plastic',
  'why-glass-matters',
  'health-optimization',
] as const;

export type Pillar = (typeof PILLARS)[number];

export const PILLAR_LABELS: Record<Pillar, string> = {
  'science-of-plastic': 'The Science of Plastic',
  'why-glass-matters': 'Why Glass Matters',
  'health-optimization': 'Health & Optimization',
};

/** One-line SEO description for each pillar's /research/[pillar] hub page. */
export const PILLAR_DESCRIPTIONS: Record<Pillar, string> = {
  'science-of-plastic':
    'What the research actually says about microplastics, plastic leaching, and where they end up in the body.',
  'why-glass-matters':
    'Straight comparisons between glass, stainless steel, and plastic — backed by material science, not marketing.',
  'health-optimization':
    'Evidence-based breakdowns of hydration, performance, and the choices that measurably affect both.',
};
