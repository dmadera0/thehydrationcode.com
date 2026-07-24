#!/usr/bin/env node
/**
 * Fails the build if src/content.config.ts (Zod, the runtime source of
 * truth for Astro) and keystatic.config.ts (the CMS schema) define a
 * different set of top-level fields for posts or bottles.
 *
 * Why a text-based check and not a real schema diff: content.config.ts
 * imports `astro:content`, a virtual module that only resolves inside
 * Astro's own Vite context — it can't be `import()`-ed from a plain Node
 * script. keystatic.config.ts has no such constraint, but comparing "a real
 * Zod schema" against "a plain object" isn't apples-to-apples anyway. This
 * extracts the top-level field names declared in each collection block from
 * the source text instead. It won't catch every kind of drift (e.g. a
 * validation rule that changed on both sides but disagrees), but it reliably
 * catches the actual failure mode: a field added, removed, or renamed on one
 * side and forgotten on the other.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const zodSource = readFileSync(join(ROOT, 'src/content.config.ts'), 'utf8');
const keystaticSource = readFileSync(join(ROOT, 'keystatic.config.ts'), 'utf8');

/** Extracts the top-level `name: z.something(` field keys inside a
 * `const NAME = defineCollection({ ... schema: ... z.object({ <here> }) })`
 * block, by locating the block via its collection variable name and
 * counting brace depth to find the matching top-level object literal. */
function extractZodFields(source, collectionVarName) {
  const start = source.indexOf(`const ${collectionVarName} = defineCollection(`);
  if (start === -1) throw new Error(`Collection "${collectionVarName}" not found in content.config.ts`);
  const objStart = source.indexOf('z.object({', start);
  if (objStart === -1) throw new Error(`z.object({ not found for "${collectionVarName}"`);
  const bodyStart = objStart + 'z.object({'.length;

  let depth = 1;
  let i = bodyStart;
  for (; i < source.length && depth > 0; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
  }
  const body = source.slice(bodyStart, i - 1);

  const fields = new Set();
  // Only match keys at this object's own top level (not nested objects) by
  // tracking bracket/paren/brace depth as we scan line by line.
  let localDepth = 0;
  for (const line of body.split('\n')) {
    const opens = (line.match(/[{([]/g) ?? []).length;
    const closes = (line.match(/[})\]]/g) ?? []).length;
    // `key: z.something` covers most fields; `key: image()` covers the
    // destructured Astro image() helper used for heroImage/image, which
    // isn't a `z.*` call. `key: z` alone (no dot on this line) covers
    // multi-line chains like `faq: z\n  .array(...)`.
    const fieldMatch = localDepth === 0 && line.match(/^\s*(?:\/\*\*.*\*\/\s*)?([a-zA-Z0-9_]+):\s*(?:z\b|image\()/);
    if (fieldMatch) fields.add(fieldMatch[1]);
    localDepth += opens - closes;
  }
  return fields;
}

/** Same idea for keystatic.config.ts: finds `NAME: collection({ ... schema:
 * { <here> } })` and extracts the top-level `key: fields.something(` names. */
function extractKeystaticFields(source, collectionName) {
  const start = source.indexOf(`${collectionName}: collection(`);
  if (start === -1) throw new Error(`Collection "${collectionName}" not found in keystatic.config.ts`);
  const schemaStart = source.indexOf('schema: {', start);
  if (schemaStart === -1) throw new Error(`schema: { not found for "${collectionName}"`);
  const bodyStart = schemaStart + 'schema: {'.length;

  let depth = 1;
  let i = bodyStart;
  for (; i < source.length && depth > 0; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
  }
  const body = source.slice(bodyStart, i - 1);

  const fields = new Set();
  let localDepth = 0;
  for (const line of body.split('\n')) {
    const opens = (line.match(/[{([]/g) ?? []).length;
    const closes = (line.match(/[})\]]/g) ?? []).length;
    const fieldMatch = localDepth === 0 && line.match(/^\s*([a-zA-Z0-9_]+):\s*fields\./);
    if (fieldMatch) fields.add(fieldMatch[1]);
    localDepth += opens - closes;
  }
  return fields;
}

// keystatic's posts collection names its MDX body field `content`, which
// has no equivalent key in the Zod schema (Zod validates frontmatter only —
// the MDX body isn't a frontmatter field). Same for bottles: no drift there,
// but declared explicitly so a real omission still gets caught.
const IGNORE = {
  posts: new Set(['content']),
  bottles: new Set([]),
};

function diff(setA, setB) {
  return [...setA].filter((x) => !setB.has(x));
}

let failed = false;

for (const [zodVar, ksVar, key] of [
  ['posts', 'posts', 'posts'],
  ['bottles', 'bottles', 'bottles'],
]) {
  const zodFields = extractZodFields(zodSource, zodVar);
  const ksFields = extractKeystaticFields(keystaticSource, ksVar);
  const ignore = IGNORE[key];

  const missingInKeystatic = diff(zodFields, ksFields).filter((f) => !ignore.has(f));
  const missingInZod = diff(ksFields, zodFields).filter((f) => !ignore.has(f));

  if (missingInKeystatic.length > 0 || missingInZod.length > 0) {
    failed = true;
    console.error(`\n✖ Schema drift in "${key}":`);
    if (missingInKeystatic.length > 0) {
      console.error(`  In content.config.ts but missing from keystatic.config.ts: ${missingInKeystatic.join(', ')}`);
    }
    if (missingInZod.length > 0) {
      console.error(`  In keystatic.config.ts but missing from content.config.ts: ${missingInZod.join(', ')}`);
    }
  }
}

if (failed) {
  console.error('\nKeep src/content.config.ts and keystatic.config.ts in sync — see the comment atop keystatic.config.ts.\n');
  process.exit(1);
}

console.log('✓ No schema drift between content.config.ts and keystatic.config.ts.');
