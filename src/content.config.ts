import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { PILLARS } from '@data/taxonomy';

/**
 * A citation. Every factual claim on this site resolves to one of these.
 * If you cannot fill this in honestly, do not make the claim.
 */
const sourceSchema = z.object({
  /** Short label shown inline, e.g. "PNAS, 2024" */
  label: z.string(),
  /** Full title of the study or article */
  title: z.string(),
  publisher: z.string(),
  year: z.number().int().min(1900).max(2100),
  url: z.string().url(),
  /** DOI where one exists. Leave undefined rather than guessing. */
  doi: z.string().optional(),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().max(70, 'Keep titles under 70 chars for SERP display'),
      /** 1–2 sentence summary. Doubles as card copy and meta description. */
      dek: z.string().min(50).max(165),
      pillar: z.enum(PILLARS),
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date().optional(),
      heroImage: image(),
      heroAlt: z.string().min(10, 'Alt text must actually describe the image'),
      featured: z.boolean().default(false),
      draft: z.boolean().default(false),
      /** Numbered source list rendered at the end of every article. */
      sources: z.array(sourceSchema).min(1, 'Every article cites at least one source'),
      faq: z
        .array(z.object({ q: z.string(), a: z.string() }))
        .optional(),
      relatedBottles: z.array(reference('bottles')).optional(),
    }),
});

const bottles = defineCollection({
  loader: glob({ pattern: '**/*.{yaml,yml,json}', base: './src/content/bottles' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      brand: z.string(),

      /**
       * PRICE RULE — read src/lib/pricing.ts before changing this.
       * Amazon forbids displaying prices not sourced from the Product
       * Advertising API and refreshed within 24h. PA-API requires three
       * qualifying sales first. Amazon products stay 'hidden' until then.
       */
      priceDisplay: z.enum(['hidden', 'range', 'exact']).default('hidden'),
      priceRange: z.string().optional(),
      price: z.number().positive().optional(),
      currency: z.literal('USD').default('USD'),

      rating: z.number().min(0).max(5),
      /** Date this review's verdict was last written/checked. Feeds Review.datePublished in JSON-LD. */
      reviewedAt: z.coerce.date(),
      tagline: z.string().max(90),
      /** e.g. "Home & desk", "Commute & gym" */
      bestFor: z.string(),
      editorsChoice: z.boolean().default(false),

      /** Three short checkmark bullets on the card. */
      features: z.array(z.string()).length(3),

      image: image(),
      imageAlt: z.string().min(10),

      /** Foreign key into src/data/affiliates.ts */
      affiliateId: z.string(),

      // Spec fields, used on the comparison table and detail page
      material: z.string(),
      capacityOz: z.number().positive(),
      dishwasherSafe: z.boolean(),
      lidType: z.string(),

      pros: z.array(z.string()).min(2),
      /** REQUIRED. A review with no downsides is an advertisement. */
      cons: z.array(z.string()).min(2, 'Every bottle lists at least two real cons'),
    })
    .refine(
      (b) => b.priceDisplay !== 'exact' || b.price !== undefined,
      { message: "priceDisplay 'exact' requires a price", path: ['price'] },
    )
    .refine(
      (b) => b.priceDisplay !== 'range' || b.priceRange !== undefined,
      { message: "priceDisplay 'range' requires a priceRange", path: ['priceRange'] },
    ),
});

export const collections = { posts, bottles };
