/**
 * migrate-json-to-sqlite.ts
 *
 * One-time script to import existing JSON flat-files into diagrams.db.
 *
 * Usage (from repo root):
 *   npx tsx mcp-server/src/migrate-json-to-sqlite.ts
 *   DIAGRAMS_DIR=/path/to/data npx tsx mcp-server/src/migrate-json-to-sqlite.ts
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ─── Resolve the data directory (same logic as storage.ts) ──────────

function resolveDiagramsDir(): string {
  const fromEnv = process.env.DIAGRAMS_DIR;
  const cwd = process.cwd();
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));

  const candidates: string[] = [];
  if (fromEnv) {
    candidates.push(path.isAbsolute(fromEnv) ? fromEnv : path.resolve(cwd, fromEnv));
  }
  candidates.push(path.join(cwd, "mcp-server", "diagrams-data"));
  candidates.push(path.join(cwd, "diagrams-data"));
  candidates.push(path.join(moduleDir, "..", "diagrams-data"));

  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
    } catch { /* skip */ }
  }
  throw new Error(
    "Could not find diagrams-data directory. Set DIAGRAMS_DIR or run from repo root."
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function readJsonSafe<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch (err) {
    console.warn(`  Skipping corrupt/unreadable file: ${filePath} (${err})`);
    return null;
  }
}

function collectJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(dir, f));
}

// ─── Main ─────────────────────────────────────────────────────────────

const dir = resolveDiagramsDir();
const dbPath = path.join(dir, "diagrams.db");

if (fs.existsSync(dbPath)) {
  console.log(`Database already exists at: ${dbPath}`);
  console.log("To re-run a fresh migration, delete diagrams.db first.");
  process.exit(0);
}

console.log(`Migrating JSON files in: ${dir}`);
console.log(`Creating database at:    ${dbPath}\n`);

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS diagrams (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    data       TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS gantt_charts (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    data       TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    data       TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS matrix_boards (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    data       TEXT NOT NULL
  );
`);

const insertDiagram = db.prepare(
  "INSERT OR REPLACE INTO diagrams (id, name, updated_at, data) VALUES (?, ?, ?, ?)"
);
const insertGantt = db.prepare(
  "INSERT OR REPLACE INTO gantt_charts (id, name, updated_at, data) VALUES (?, ?, ?, ?)"
);
const insertSession = db.prepare(
  "INSERT OR REPLACE INTO sessions (id, title, updated_at, data) VALUES (?, ?, ?, ?)"
);
const insertMatrix = db.prepare(
  "INSERT OR REPLACE INTO matrix_boards (id, name, updated_at, data) VALUES (?, ?, ?, ?)"
);

let counts = { diagrams: 0, gantt: 0, sessions: 0, matrix: 0 };

// Diagrams (root JSON files, skip subdirectory files)
for (const fp of collectJsonFiles(dir)) {
  type D = { id: string; name: string; updatedAt: string };
  const doc = readJsonSafe<D>(fp);
  if (!doc?.id || !doc?.name) continue;
  insertDiagram.run(doc.id, doc.name, doc.updatedAt ?? new Date().toISOString(), JSON.stringify(doc));
  counts.diagrams++;
}

// Gantt charts
for (const fp of collectJsonFiles(path.join(dir, "gantt"))) {
  type G = { id: string; name: string; updatedAt: string };
  const doc = readJsonSafe<G>(fp);
  if (!doc?.id || !doc?.name) continue;
  insertGantt.run(doc.id, doc.name, doc.updatedAt ?? new Date().toISOString(), JSON.stringify(doc));
  counts.gantt++;
}

// Sessions
for (const fp of collectJsonFiles(path.join(dir, "sessions"))) {
  type S = { id: string; title: string; updatedAt: string };
  const doc = readJsonSafe<S>(fp);
  if (!doc?.id || !doc?.title) continue;
  insertSession.run(doc.id, doc.title, doc.updatedAt ?? new Date().toISOString(), JSON.stringify(doc));
  counts.sessions++;
}

// Matrix boards
for (const fp of collectJsonFiles(path.join(dir, "matrix"))) {
  type M = { id: string; name: string; updatedAt: string };
  const doc = readJsonSafe<M>(fp);
  if (!doc?.id || !doc?.name) continue;
  insertMatrix.run(doc.id, doc.name, doc.updatedAt ?? new Date().toISOString(), JSON.stringify(doc));
  counts.matrix++;
}

db.close();

console.log("Migration complete:");
console.log(`  diagrams:     ${counts.diagrams}`);
console.log(`  gantt charts: ${counts.gantt}`);
console.log(`  sessions:     ${counts.sessions}`);
console.log(`  matrix boards:${counts.matrix}`);
console.log(`\nDatabase: ${dbPath}`);
