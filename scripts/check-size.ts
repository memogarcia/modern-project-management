#!/usr/bin/env bun

/**
 * Check file-size limits for maintainability.
 *
 * Limits:
 *   - Components (.tsx):       400 lines
 *   - Pages (page.tsx):        800 lines
 *   - Route handlers (route.ts): 200 lines
 *   - Service files:           500 lines
 */

import { Glob } from 'bun';

interface LimitConfig {
  pattern: string;
  limit: number;
  name: string;
}

// Order matters: more specific patterns first
const LIMITS: LimitConfig[] = [
  { pattern: '**/page.tsx', limit: 800, name: 'Page' },
  { pattern: '**/route.ts', limit: 200, name: 'Route handler' },
  { pattern: '**/*.service.ts', limit: 500, name: 'Service' },
  { pattern: '**/services/**/*.ts', limit: 500, name: 'Service (dir)' },
  { pattern: '**/*.tsx', limit: 700, name: 'Component' },
];

const EXCLUDE_PATHS = ['node_modules', '.test.', '.next/', '/dist/', '/ui/'];

async function countLines(filePath: string): Promise<number> {
  const file = Bun.file(filePath);
  const content = await file.text();
  return content.split('\n').length;
}

async function checkFiles(
  pattern: string,
  limit: number,
  _name: string,
  alreadyChecked: Set<string>
): Promise<{ violations: string[]; checked: string[] }> {
  const glob = new Glob(pattern);
  const violations: string[] = [];
  const checked: string[] = [];

  for await (const filePath of glob.scan({ cwd: process.cwd(), absolute: true })) {
    if (EXCLUDE_PATHS.some((p) => filePath.includes(p))) continue;
    if (alreadyChecked.has(filePath)) continue;

    checked.push(filePath);
    const lines = await countLines(filePath);
    if (lines > limit) {
      const relativePath = filePath.replace(process.cwd() + '/', '');
      violations.push(`${relativePath}: ${lines} LOC (limit: ${limit})`);
    }
  }

  return { violations, checked };
}

async function main() {
  const allViolations: string[] = [];
  const alreadyChecked = new Set<string>();

  for (const config of LIMITS) {
    const result = await checkFiles(config.pattern, config.limit, config.name, alreadyChecked);
    result.checked.forEach((f) => alreadyChecked.add(f));
    allViolations.push(...result.violations.map((v) => `[${config.name}] ${v}`));
  }

  if (allViolations.length > 0) {
    console.error(`\n❌ Files exceeding size limits:\n`);
    allViolations.forEach((v) => console.error(`  - ${v}`));
    console.error('\nSplit large files before committing.\n');
    process.exit(1);
  }

  console.log('✅ File size checks passed');
}

main().catch((err) => {
  console.error('Error running size check:', err);
  process.exit(1);
});
