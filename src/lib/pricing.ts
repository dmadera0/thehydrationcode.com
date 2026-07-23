import type { CollectionEntry } from 'astro:content';
import { getAffiliate } from '@data/affiliates';

/**
 * PRICE DISPLAY POLICY
 *
 * Amazon's Operating Agreement prohibits displaying Amazon prices unless they
 * are sourced from the Product Advertising API and refreshed within 24 hours.
 * PA-API access is not granted until the Associates account has cleared three
 * qualifying sales — so at launch we cannot show Amazon prices at all.
 *
 * Non-Amazon merchants have no such restriction, but a stale price is still a
 * trust problem, so those render as a range with an "as of" date.
 *
 * When PA-API access arrives: implement fetchLivePrice() below, flip the
 * affected bottles to priceDisplay: 'exact', and the cards light up with no
 * component changes.
 */

export type PriceRender =
  | { kind: 'hidden'; cta: string }
  | { kind: 'range'; text: string; cta: string }
  | { kind: 'exact'; text: string; cta: string };

type Bottle = CollectionEntry<'bottles'>['data'];

export function resolvePrice(bottle: Bottle): PriceRender {
  const entry = getAffiliate(bottle.affiliateId);

  // Hard gate: Amazon never shows a price until PA-API is wired.
  if (entry.network === 'amazon') {
    return { kind: 'hidden', cta: 'Check price' };
  }

  if (bottle.priceDisplay === 'exact' && bottle.price !== undefined) {
    return {
      kind: 'exact',
      text: formatUsd(bottle.price),
      cta: 'View bottle',
    };
  }

  if (bottle.priceDisplay === 'range' && bottle.priceRange) {
    return { kind: 'range', text: bottle.priceRange, cta: 'View bottle' };
  }

  return { kind: 'hidden', cta: 'Check price' };
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

/** TODO: wire PA-API once the Associates account clears three qualifying sales. */
export async function fetchLivePrice(_asin: string): Promise<number | null> {
  throw new Error('PA-API not yet available. See docs/AFFILIATE.md.');
}
