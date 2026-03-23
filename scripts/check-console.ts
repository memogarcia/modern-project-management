#!/usr/bin/env bun

/**
 * Check for console.* statements in production code.
 * Excludes: tests, scripts, node_modules, migration scripts.
 *
 * Allowed:
 *   - console.error (error handlers, MCP stdio servers)
 *   - console.warn  (deprecation notices, non-fatal issues)
 *
 * Blocked:
 *   - console.log, console.debug, console.info, console.trace, console.table
 */

import { $ } from 'bun';

const SEARCH_DIRS = ['app/src', 'mcp-server/src', 'shared/src'];
const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/__tests__/**',
  '**/scripts/**',
  '**/migrate-*.ts',
];

async function main() {
  // Check if ripgrep is available
  try {
    await $`which rg`.quiet();
  } catch {
    console.error('❌ ripgrep (rg) is not installed. Install it with: brew install ripgrep');
    process.exit(1);
  }

  // Filter to only existing directories
  const existingDirs: string[] = [];
  for (const dir of SEARCH_DIRS) {
    try {
      const result = await $`test -d ${dir}`.quiet().nothrow();
      if (result.exitCode === 0) {
        existingDirs.push(dir);
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }

  if (existingDirs.length === 0) {
    console.log('✅ No source directories found to check');
    process.exit(0);
  }

  const excludeArgs = EXCLUDE_PATTERNS.flatMap((p) => ['-g', `!${p}`]);

  // Only flag console.log, console.debug, console.info, console.trace, console.table
  // Allow console.error and console.warn (standard for error handling)
  const pattern = 'console\\.(log|debug|info|trace|table)\\b';

  try {
    const result =
      await $`rg -n ${pattern} ${existingDirs} -g "*.ts" -g "*.tsx" ${excludeArgs}`.quiet();

    if (result.stdout.toString().trim()) {
      console.error('\n❌ Blocked console statements found in production code:\n');
      console.error(result.stdout.toString());
      console.error('\nUse console.error/console.warn or a proper logger instead.\n');
      process.exit(1);
    }
  } catch (error: unknown) {
    // ripgrep returns exit code 1 when no matches found (which is good)
    const exitCode = (error as { exitCode?: number }).exitCode;
    if (exitCode === 1) {
      console.log('✅ No blocked console statements in production code');
      process.exit(0);
    }
    throw error;
  }

  console.log('✅ No blocked console statements in production code');
}

main().catch((err) => {
  console.error('Error running console check:', err);
  process.exit(1);
});
