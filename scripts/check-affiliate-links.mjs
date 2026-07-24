#!/usr/bin/env node
/**
 * Two rules, both enforced at build time:
 *
 * 1. A known merchant/affiliate-network domain may only appear in the
 *    affiliate registry (src/data/affiliates.ts and the per-id entries
 *    under src/data/affiliates/*.json that Keystatic manages). See
 *    CLAUDE.md hard rule #2 and docs/AFFILIATE.md.
 * 2. Inside src/content/, no external http(s) link may appear except a
 *    frontmatter `sources` entry (real citations, which must stay direct)
 *    and the /go/{id} cloaked path. This is what catches a direct-brand
 *    merchant link that isn't in the registry yet — rule 1's denylist can't,
 *    since it only knows about domains someone already registered.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');
const CONTENT_DIR = join(SRC, 'content');
const ALLOWED_FILE = join(SRC, 'data', 'affiliates.ts');
const ALLOWED_DIR = join(SRC, 'data', 'affiliates') + '/';

function isAllowedFile(file) {
  return file === ALLOWED_FILE || file.startsWith(ALLOWED_DIR);
}

const KNOWN_MERCHANT_DOMAINS = [
  'amazon.com',
  'amzn.to',
  'shareasale.com',
  'impact.com',
  'impactradius.com',
  'awin.com',
  'cj.com',
  'rakuten.com',
];

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.astro', '.mdx', '.md', '.yaml', '.yml', '.json']);

function extractRegisteredDomains(source) {
  const domains = new Set();
  for (const match of source.matchAll(/https?:\/\/(?:www\.)?([a-z0-9.-]+)/gi)) {
    domains.add(match[1].toLowerCase());
  }
  return domains;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full, files);
    } else if (SCAN_EXTENSIONS.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

/** Strips top-level frontmatter `sources:` blocks — the one place a direct
 * external URL is expected and required. Matches the key line plus every
 * subsequent indented line (i.e. the whole YAML block under it). */
function stripSourcesBlocks(text) {
  return text.replace(/^sources:\n(?:[ \t]+.*\n?|\n)*/gm, '');
}

const registrySources = [ALLOWED_FILE, ...walk(ALLOWED_DIR)]
  .filter((f, i, arr) => arr.indexOf(f) === i)
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');
const forbiddenDomains = new Set([...KNOWN_MERCHANT_DOMAINS, ...extractRegisteredDomains(registrySources)]);
const domainPattern = new RegExp(
  `\\b(${[...forbiddenDomains].map((d) => d.replace(/\./g, '\\.')).join('|')})\\b`,
  'gi',
);

const violations = [];

for (const file of walk(SRC)) {
  if (isAllowedFile(file)) continue;
  const contents = readFileSync(file, 'utf8');
  const relPath = relative(ROOT, file);

  // Rule 1: known merchant domains, anywhere outside the registry.
  for (const match of contents.matchAll(domainPattern)) {
    violations.push(`${relPath}:${lineOf(contents, match.index)} — merchant domain "${match[1]}"`);
  }

  // Rule 2: raw external links inside src/content/, outside `sources:`.
  if (file.startsWith(CONTENT_DIR + '/')) {
    const withoutSources = stripSourcesBlocks(contents);
    for (const match of withoutSources.matchAll(/https?:\/\/[^\s"'<>)]+/gi)) {
      violations.push(
        `${relPath}:${lineOf(withoutSources, match.index)} — direct external link outside frontmatter sources: "${match[0]}"`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error('\n✖ Affiliate link guard failed.\n');
  console.error('  Rule 1: raw merchant URLs may only appear in the affiliate registry');
  console.error('          (src/data/affiliates.ts / src/data/affiliates/*.json).');
  console.error('  Rule 2: src/content/ may not contain a direct external link outside');
  console.error('          frontmatter `sources` — route it through <AffiliateLink> or /go/.\n');
  console.error('  Violations:\n');
  for (const v of violations) console.error(`  - ${v}`);
  console.error('');
  process.exit(1);
}

console.log('✓ Affiliate link guard passed.');
