/**
 * AFFILIATE REGISTRY
 *
 * The only place in this codebase where a merchant URL may appear.
 * Everything else references an entry by id and renders it through
 * <AffiliateLink>, which handles rel attributes, cloaking, and tracking.
 *
 * Why: when a tag changes, a program drops us, or a product goes out of
 * stock, this is a one-file edit instead of a grep across every MDX post.
 */

export type AffiliateNetwork =
  | 'amazon'
  | 'shareasale'
  | 'impact'
  | 'direct';

export interface AffiliateEntry {
  network: AffiliateNetwork;
  /** Destination URL. Tracking params are appended at build time. */
  url: string;
  /** Human label, used for analytics events and internal reporting. */
  label: string;
  /** Merchant name shown in the disclosure context. */
  merchant: string;
  /** Set false to render the product without a live link (out of stock, program ended). */
  active?: boolean;
}

export const affiliates = {
  'purelane-classic': {
    network: 'amazon',
    url: 'https://www.amazon.com/dp/PLACEHOLDER01',
    label: 'Purelane Classic Cork-Top Glass Bottle',
    merchant: 'Amazon',
  },
  'vireo-sleeve': {
    network: 'amazon',
    url: 'https://www.amazon.com/dp/PLACEHOLDER02',
    label: 'Vireo Protected Glass Bottle with Silicone Sleeve',
    merchant: 'Amazon',
  },
  'ora-tall': {
    network: 'amazon',
    url: 'https://www.amazon.com/dp/PLACEHOLDER03',
    label: 'Ora Tall Minimalist Glass Bottle',
    merchant: 'Amazon',
  },
  'botanica-infuser': {
    network: 'amazon',
    url: 'https://www.amazon.com/dp/PLACEHOLDER04',
    label: 'Botanica Fruit-Infuser Glass Bottle',
    merchant: 'Amazon',
  },
} as const satisfies Record<string, AffiliateEntry>;

export type AffiliateId = keyof typeof affiliates;

/** Runtime-safe lookup. Throws at build time on a bad id rather than shipping a dead link. */
export function getAffiliate(id: string): AffiliateEntry {
  const entry = (affiliates as Record<string, AffiliateEntry>)[id];
  if (!entry) {
    throw new Error(
      `Unknown affiliate id "${id}". Add it to src/data/affiliates.ts.`,
    );
  }
  return entry;
}

export function listAffiliateIds(): AffiliateId[] {
  return Object.keys(affiliates) as AffiliateId[];
}

/**
 * Appends the network's tracking parameter to the destination URL.
 * IDs come from env and are never committed. A missing ID is not fatal —
 * the link still works, it just earns nothing. That's the correct behaviour
 * pre-approval, so the site can launch before the Associates account exists.
 */
export function buildTrackedUrl(entry: AffiliateEntry): string {
  const url = new URL(entry.url);

  switch (entry.network) {
    case 'amazon': {
      const tag = import.meta.env.AMAZON_ASSOCIATE_TAG;
      if (tag) url.searchParams.set('tag', tag);
      break;
    }
    case 'shareasale': {
      const id = import.meta.env.SHAREASALE_ID;
      if (id) url.searchParams.set('afftrack', id);
      break;
    }
    case 'impact': {
      const id = import.meta.env.IMPACT_ID;
      if (id) url.searchParams.set('irpid', id);
      break;
    }
    case 'direct':
      break;
  }

  return url.toString();
}
