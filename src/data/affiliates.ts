/**
 * AFFILIATE REGISTRY
 *
 * The only place in this codebase where a merchant URL may appear.
 * Everything else references an entry by id and renders it through
 * <AffiliateLink>, which handles rel attributes, cloaking, and tracking.
 *
 * Data lives in src/data/affiliates/*.json — one file per id — so Keystatic
 * can manage it as a real collection (see keystatic.config.ts). This file
 * just aggregates those entries at build time via import.meta.glob (eager,
 * so it's synchronous — every existing caller here stays synchronous too,
 * no async refactor needed anywhere that imports from this module).
 *
 * Why a registry at all: when a tag changes, a program drops us, or a
 * product goes out of stock, this is a one-file edit instead of a grep
 * across every MDX post.
 */

export type AffiliateNetwork = 'amazon' | 'shareasale' | 'impact' | 'direct';

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

const modules = import.meta.glob<{ default: AffiliateEntry }>('./affiliates/*.json', {
  eager: true,
});

function idFromPath(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.json$/, '');
}

export const affiliates: Record<string, AffiliateEntry> = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => [idFromPath(path), mod.default]),
);

export type AffiliateId = string;

/** Runtime-safe lookup. Throws at build time on a bad id rather than shipping a dead link. */
export function getAffiliate(id: string): AffiliateEntry {
  const entry = affiliates[id];
  if (!entry) {
    throw new Error(`Unknown affiliate id "${id}". Add src/data/affiliates/${id}.json.`);
  }
  return entry;
}

export function listAffiliateIds(): AffiliateId[] {
  return Object.keys(affiliates);
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
