import { config, fields, collection, singleton } from '@keystatic/core';
import { block, wrapper, inline } from '@keystatic/core/content-components';
import { PILLARS, PILLAR_LABELS } from './src/data/taxonomy';

/**
 * Mirrors src/content.config.ts EXACTLY. If you change a field there, change
 * it here too — there is no automated sync between the two, which is why
 * scripts/check-schema-drift.mjs exists (run via `pnpm check:schema-drift`,
 * wired into `pnpm check`). It fails the build if the two definitions of
 * "what a post/bottle looks like" drift apart.
 *
 * Hard rule 7 (CLAUDE.md — a citation must link the actual source, readable
 * without payment) applies to anything entered here exactly as it does to
 * hand-edited files. The CMS does not relax that rule.
 */

const pillarOptions = PILLARS.map((value) => ({ label: PILLAR_LABELS[value], value }));

// Insertable MDX blocks — must match the components registered in
// src/components/content/mdx.ts. Keystatic statically analyzes MDX, so
// these are inserted as component tags with no import statement, exactly
// like mdxComponents already expects.
const mdxComponents = {
  Citation: inline({
    label: 'Citation',
    schema: {
      id: fields.integer({
        label: 'Source number',
        description: 'Matches the 1-based position of the source in the Sources list below.',
        validation: { isRequired: true, min: 1 },
      }),
    },
  }),
  StatBlock: block({
    label: 'Stat Block',
    schema: {
      value: fields.text({ label: 'Value', description: 'e.g. 240,000 or 93%' }),
      label: fields.text({ label: 'Label' }),
      source: fields.text({ label: 'Source name shown under the stat' }),
      sourceId: fields.integer({
        label: 'Source number (optional)',
        description: 'Links the source line to a numbered entry in Sources below.',
      }),
    },
  }),
  Callout: wrapper({
    label: 'Callout',
    schema: {
      variant: fields.select({
        label: 'Variant',
        options: [
          { label: 'Note', value: 'note' },
          { label: 'Warning', value: 'warning' },
          { label: 'Key takeaway', value: 'key' },
        ],
        defaultValue: 'note',
      }),
    },
  }),
  ComparisonTable: block({
    label: 'Comparison Table',
    schema: {
      caption: fields.text({ label: 'Caption (optional)' }),
      headers: fields.array(fields.text({ label: 'Header' }), {
        label: 'Headers',
        itemLabel: (props) => props.value || 'Header',
      }),
      rows: fields.array(
        fields.array(fields.text({ label: 'Cell' }), {
          label: 'Row',
          itemLabel: (props) => props.value || 'Cell',
        }),
        { label: 'Rows', itemLabel: () => 'Row' },
      ),
    },
  }),
  KeyTakeaways: wrapper({
    label: 'Key Takeaways',
    schema: {
      title: fields.text({ label: 'Title', defaultValue: 'Key takeaways' }),
    },
  }),
};

const sourceField = fields.object({
  label: fields.text({ label: 'Label (e.g. "PNAS, 2024")' }),
  title: fields.text({ label: 'Study/article title' }),
  publisher: fields.text({ label: 'Publisher' }),
  year: fields.integer({ label: 'Year', validation: { isRequired: true, min: 1900, max: 2100 } }),
  url: fields.url({
    label: 'URL',
    description: 'The authority’s own page, readable without payment. See CLAUDE.md hard rule 7.',
    validation: { isRequired: true },
  }),
  doi: fields.text({ label: 'DOI (optional)' }),
});

// import.meta.env, not process.env — this config is evaluated in the
// browser too (Keystatic's admin UI reads it client-side), and `process`
// doesn't exist there. import.meta.env is always defined in both contexts.
export default config({
  storage:
    import.meta.env.KEYSTATIC_STORAGE === 'github'
      ? {
          kind: 'github',
          repo: {
            owner: import.meta.env.KEYSTATIC_GITHUB_OWNER ?? 'REPLACE_ME',
            name: import.meta.env.KEYSTATIC_GITHUB_REPO ?? 'REPLACE_ME',
          },
        }
      : { kind: 'local' },

  collections: {
    posts: collection({
      label: 'Posts',
      path: 'src/content/posts/*',
      format: { contentField: 'content' },
      slugField: 'title',
      entryLayout: 'content',
      columns: ['title', 'pillar', 'publishedAt', 'draft'],
      schema: {
        title: fields.slug({
          name: { label: 'Title', validation: { length: { max: 70 } } },
        }),
        dek: fields.text({
          label: 'Dek',
          description: '1-2 sentence summary. Used in cards and as the meta description.',
          multiline: true,
          validation: { length: { min: 50, max: 165 } },
        }),
        pillar: fields.select({ label: 'Pillar', options: pillarOptions, defaultValue: pillarOptions[0].value }),
        publishedAt: fields.date({ label: 'Published', validation: { isRequired: true } }),
        updatedAt: fields.date({ label: 'Updated (optional)' }),
        heroImage: fields.image({
          label: 'Hero image',
          directory: 'src/assets/images/posts',
          publicPath: '../../assets/images/posts/',
          validation: { isRequired: true },
        }),
        heroAlt: fields.text({
          label: 'Hero image alt text',
          validation: { isRequired: true, length: { min: 10 } },
        }),
        featured: fields.checkbox({ label: 'Featured on homepage', defaultValue: false }),
        draft: fields.checkbox({ label: 'Draft (excluded from production builds)', defaultValue: false }),
        sources: fields.array(sourceField, {
          label: 'Sources',
          description: 'Every article cites at least one. Hard rule 7 applies to every url here.',
          itemLabel: (props) => props.fields.label.value || 'Source',
          validation: { length: { min: 1 } },
        }),
        faq: fields.array(
          fields.object({
            q: fields.text({ label: 'Question' }),
            a: fields.text({ label: 'Answer', multiline: true }),
          }),
          { label: 'FAQ (optional)', itemLabel: (props) => props.fields.q.value || 'Question' },
        ),
        relatedBottles: fields.array(fields.relationship({ label: 'Bottle', collection: 'bottles' }), {
          label: 'Related bottles (optional)',
          itemLabel: (props) => props.value ?? 'Bottle',
        }),
        content: fields.mdx({
          label: 'Body',
          extension: 'mdx',
          components: mdxComponents,
        }),
      },
    }),

    bottles: collection({
      label: 'Bottles',
      path: 'src/content/bottles/*',
      format: 'yaml',
      slugField: 'name',
      columns: ['name', 'brand', 'rating', 'editorsChoice'],
      schema: {
        name: fields.slug({ name: { label: 'Name' } }),
        brand: fields.text({ label: 'Brand', validation: { isRequired: true } }),

        priceDisplay: fields.select({
          label: 'Price display',
          description:
            'Amazon products MUST stay "hidden" — see src/lib/pricing.ts and CLAUDE.md hard rule 3.',
          options: [
            { label: 'Hidden (Amazon)', value: 'hidden' },
            { label: 'Range', value: 'range' },
            { label: 'Exact', value: 'exact' },
          ],
          defaultValue: 'hidden',
        }),
        priceRange: fields.text({ label: 'Price range (e.g. "$30–40")' }),
        price: fields.number({ label: 'Price (non-Amazon only)' }),
        currency: fields.text({ label: 'Currency', defaultValue: 'USD' }),

        rating: fields.number({
          label: 'Rating (0–5)',
          validation: { isRequired: true, min: 0, max: 5 },
        }),
        reviewedAt: fields.date({ label: 'Reviewed on', validation: { isRequired: true } }),
        tagline: fields.text({ label: 'Tagline', validation: { length: { max: 90 } } }),
        bestFor: fields.text({ label: 'Best for (e.g. "Home & desk")' }),
        editorsChoice: fields.checkbox({ label: "Editor's Choice", defaultValue: false }),

        features: fields.array(fields.text({ label: 'Feature' }), {
          label: 'Features (exactly 3)',
          itemLabel: (props) => props.value || 'Feature',
          validation: { length: { min: 3, max: 3 } },
        }),

        image: fields.image({
          label: 'Product image',
          directory: 'src/assets/images/bottles',
          publicPath: '../../assets/images/bottles/',
          validation: { isRequired: true },
        }),
        imageAlt: fields.text({ label: 'Image alt text', validation: { isRequired: true, length: { min: 10 } } }),

        affiliateId: fields.relationship({
          label: 'Affiliate link',
          collection: 'affiliates',
          validation: { isRequired: true },
        }),

        material: fields.text({ label: 'Material' }),
        capacityOz: fields.number({ label: 'Capacity (oz)', validation: { isRequired: true, min: 0 } }),
        dishwasherSafe: fields.checkbox({ label: 'Dishwasher safe' }),
        lidType: fields.text({ label: 'Lid type' }),

        pros: fields.array(fields.text({ label: 'Pro' }), {
          label: 'Pros',
          itemLabel: (props) => props.value || 'Pro',
          validation: { length: { min: 2 } },
        }),
        cons: fields.array(fields.text({ label: 'Con' }), {
          label: 'Cons',
          description: 'Minimum two, and they must be real. A review with no downsides is an advertisement.',
          itemLabel: (props) => props.value || 'Con',
          validation: { length: { min: 2 } },
        }),
      },
    }),

    affiliates: collection({
      label: 'Affiliates',
      path: 'src/data/affiliates/*',
      format: 'json',
      slugField: 'label',
      columns: ['label', 'network', 'merchant', 'active'],
      schema: {
        label: fields.slug({ name: { label: 'Label' } }),
        network: fields.select({
          label: 'Network',
          options: [
            { label: 'Amazon', value: 'amazon' },
            { label: 'ShareASale', value: 'shareasale' },
            { label: 'Impact', value: 'impact' },
            { label: 'Direct', value: 'direct' },
          ],
          defaultValue: 'amazon',
        }),
        url: fields.url({
          label: 'Destination URL',
          description: 'The only field in the whole codebase allowed to hold a raw merchant URL.',
          validation: { isRequired: true },
        }),
        merchant: fields.text({ label: 'Merchant name (shown in disclosure context)' }),
        active: fields.checkbox({
          label: 'Active',
          description: 'Uncheck if the product is out of stock or the program ended.',
          defaultValue: true,
        }),
      },
    }),
  },

  singletons: {
    siteSettings: singleton({
      label: 'Site Settings',
      path: 'src/data/site-settings',
      format: 'json',
      schema: {
        hero: fields.object(
          {
            eyebrow: fields.text({ label: 'Eyebrow pill text' }),
            title: fields.text({ label: 'H1' }),
            subtext: fields.text({ label: 'Supporting paragraph', multiline: true }),
            primaryCtaLabel: fields.text({ label: 'Primary CTA label' }),
            secondaryCtaLabel: fields.text({ label: 'Secondary CTA label' }),
            trustLine: fields.text({ label: 'Micro-trust line' }),
          },
          { label: 'Hero' },
        ),
        footer: fields.object(
          {
            promise: fields.text({ label: 'Brand promise', multiline: true }),
            disclosure: fields.text({ label: 'Affiliate disclosure (short)', multiline: true }),
          },
          { label: 'Footer' },
        ),
        heroStats: fields.array(
          fields.object({
            value: fields.text({ label: 'Value (e.g. "240,000")' }),
            label: fields.text({ label: 'Label' }),
            source: fields.text({ label: 'Source name' }),
            url: fields.url({
              label: 'Source URL',
              description: 'The authority’s own page, readable without payment. See CLAUDE.md hard rule 7.',
              validation: { isRequired: true },
            }),
            verified: fields.checkbox({
              label: 'Verified',
              description: 'Do not set true until the figure and url have been directly confirmed.',
              defaultValue: false,
            }),
          }),
          {
            label: 'Homepage stat band',
            description: 'EVERY FIGURE MUST BE VERIFIED. One wrong headline number is fatal to this site.',
            itemLabel: (props) => props.fields.value.value || 'Stat',
            validation: { length: { min: 3, max: 4 } },
          },
        ),
      },
    }),
  },
});
