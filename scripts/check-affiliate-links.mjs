#!/usr/bin/env node
/**
 * Fails the build if a merchant domain appears anywhere outside
 * src/data/affiliates.ts. That file is the only place a real merchant URL
 * is allowed to exist — see CLAUDE.md hard rule #2 and docs/AFFILIATE.md.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');
const ALLOWED_FILE = join(SRC, 'data', 'affiliates.ts');

// Known affiliate-network domains, plus whatever's actually registered in
// affiliates.ts (kept in sync automatically instead of hardcoded twice).
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

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full, files);
    } else if (SCAN_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      files.push(full);
    }
  }
  return files;
}

const registrySource = readFileSync(ALLOWED_FILE, 'utf8');
const forbiddenDomains = new Set([...KNOWN_MERCHANT_DOMAINS, ...extractRegisteredDomains(registrySource)]);

const domainPattern = new RegExp(
  `\\b(${[...forbiddenDomains].map((d) => d.replace(/\./g, '\\.')).join('|')})\\b`,
  'i',
);

const violations = [];

for (const file of walk(SRC)) {
  if (file === ALLOWED_FILE) continue;
  const contents = readFileSync(file, 'utf8');
  const match = contents.match(domainPattern);
  if (match) {
    const line = contents.slice(0, match.index).split('\n').length;
    violations.push(`${relative(ROOT, file)}:${line} — found "${match[1]}"`);
  }
}

if (violations.length > 0) {
  console.error('\n✖ Merchant domain guard failed.');
  console.error('  Raw merchant URLs may only appear in src/data/affiliates.ts.');
  console.error('  Route through <AffiliateLink> instead. Violations:\n');
  for (const v of violations) console.error(`  - ${v}`);
  console.error('');
  process.exit(1);
}

console.log('✓ Merchant domain guard passed — no merchant URLs found outside src/data/affiliates.ts.');
