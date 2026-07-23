/**
 * Components available inside every post body without a per-file import.
 * Pass this map to <Content components={mdxComponents} /> when rendering.
 */
import Callout from './Callout.astro';
import Citation from './Citation.astro';
import ComparisonTable from './ComparisonTable.astro';
import KeyTakeaways from './KeyTakeaways.astro';
import StatBlock from './StatBlock.astro';

export const mdxComponents = {
  Callout,
  Citation,
  ComparisonTable,
  KeyTakeaways,
  StatBlock,
};
