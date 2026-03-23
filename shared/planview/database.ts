import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type BetterSqlite3 from "better-sqlite3";
import {
  type ArtifactReference,
  type DiagramDocument,
  type DiagramEdgeMetadata,
  type DiagramNodeMetadata,
  type DiagramSummary,
  type KnowledgePattern,
  type SessionCommand,
  type SessionComment,
  type SessionTimelineEntry,
  type TroubleshootingSearchHit,
  type TroubleshootingSession,
} from "./domain.js";
import { asPlanViewError, PlanViewError } from "./errors.js";
import {
  createDiagramSummary,
  hydrateDiagramDocument,
  normalizeDiagramGraph,
} from "./graph.js";
import { flowToMermaid, validateMermaidDocument } from "./mermaid.js";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3") as typeof import("better-sqlite3");
const DatabaseConstructor =
  ((Database as unknown as { default?: typeof Database }).default ?? Database) as typeof Database;
const betterSqlitePackagePath = require.resolve("better-sqlite3/package.json");
const betterSqliteNativeBindingPath = path.join(
  path.dirname(betterSqlitePackagePath),
  "build/Release/better_sqlite3.node"
);

export type PlanViewDatabase = BetterSqlite3.Database;
type BetterSqliteDatabase = PlanViewDatabase;

type SessionRow = {
  id: string;
  diagram_id: string;
  project_id?: string | null;
  system_scope?: string | null;
  title: string;
  summary: string;
  status: string;
  notes_markdown?: string | null;
  hypotheses_json?: string | null;
  ai_transcript_references_json?: string | null;
  resolution_summary?: string | null;
  reusable_pattern_id?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
};

type ArtifactOwnerType = "node" | "edge" | "session";

type ArtifactRow = {
  id: string;
  owner_type: ArtifactOwnerType;
  diagram_id?: string | null;
  owner_id: string;
  label: string;
  file_name: string;
  relative_path: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  created_at: string;
};

export type PlanViewArtifactRecord = ArtifactReference & {
  ownerType: ArtifactOwnerType;
  diagramId?: string | null;
  ownerId: string;
};

export type PlanViewArtifactFile = PlanViewArtifactRecord & {
  absolutePath: string;
};

let singletonDb: BetterSqliteDatabase | null = null;

function ensureDir(target: string): void {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
}

export function resolvePlanViewDbPath(): string {
  const fromEnv = process.env.PLANVIEW_DB;
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
  }

  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
  ];

  for (const root of candidates) {
    const mcpDir = path.join(root, "mcp-server");
    if (fs.existsSync(mcpDir)) {
      return path.join(mcpDir, "data", "planview.db");
    }
  }

  return path.join(process.cwd(), "data", "planview.db");
}

export function resolvePlanViewArtifactsDir(): string {
  const fromEnv = process.env.PLANVIEW_ARTIFACTS_DIR;
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
  }
  return path.join(path.dirname(resolvePlanViewDbPath()), "artifacts");
}

function tableInfo(db: BetterSqliteDatabase, tableName: string): Array<{ name: string; pk: number }> {
  return db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string; pk: number }>;
}

function columnExists(db: BetterSqliteDatabase, tableName: string, columnName: string): boolean {
  return tableInfo(db, tableName).some((column) => column.name === columnName);
}

function ensureMigrationTable(db: BetterSqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

function applyColumnsCompositePrimaryKeyMigration(db: BetterSqliteDatabase): void {
  const info = tableInfo(db, "columns");
  if (info.length === 0) return;

  const idColumn = info.find((column) => column.name === "id");
  const projectIdColumn = info.find((column) => column.name === "project_id");
  const isCompositePrimaryKey = Boolean(idColumn?.pk) && Boolean(projectIdColumn?.pk);
  if (isCompositePrimaryKey) return;

  const priorForeignKeys = db.pragma("foreign_keys", { simple: true }) as number;
  db.pragma("foreign_keys = OFF");

  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS columns_new (
          id TEXT NOT NULL,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          color TEXT NOT NULL DEFAULT '#94a3b8',
          position INTEGER NOT NULL DEFAULT 0,
          wip_limit INTEGER,
          PRIMARY KEY (project_id, id)
        );
      `);

      db.prepare(`
        INSERT INTO columns_new (id, project_id, name, color, position, wip_limit)
        SELECT id, project_id, name, color, position, wip_limit FROM columns
      `).run();

      db.exec("DROP TABLE columns;");
      db.exec("ALTER TABLE columns_new RENAME TO columns;");

      db.exec(`
        CREATE TABLE IF NOT EXISTS tasks_new (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          epic_id TEXT REFERENCES epics(id) ON DELETE SET NULL,
          column_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          priority TEXT NOT NULL DEFAULT 'medium',
          assignee TEXT,
          start_date TEXT,
          due_date TEXT,
          progress INTEGER NOT NULL DEFAULT 0,
          position INTEGER NOT NULL DEFAULT 0,
          color TEXT,
          metadata TEXT DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id, column_id) REFERENCES columns(project_id, id) ON DELETE CASCADE
        );
      `);

      db.prepare(`
        INSERT INTO tasks_new (
          id, project_id, epic_id, column_id, name, description, priority, assignee,
          start_date, due_date, progress, position, color, metadata, created_at, updated_at
        )
        SELECT
          id, project_id, epic_id, column_id, name, description, priority, assignee,
          start_date, due_date, progress, position, color, metadata, created_at, updated_at
        FROM tasks
      `).run();

      db.exec("DROP TABLE tasks;");
      db.exec("ALTER TABLE tasks_new RENAME TO tasks;");
    })();
  } finally {
    db.pragma(`foreign_keys = ${priorForeignKeys ? "ON" : "OFF"}`);
  }
}

function createBaseSchema(db: BetterSqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS columns (
      id TEXT NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#94a3b8',
      position INTEGER NOT NULL DEFAULT 0,
      wip_limit INTEGER,
      PRIMARY KEY (project_id, id)
    );

    CREATE TABLE IF NOT EXISTS epics (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#6b7280',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      epic_id TEXT REFERENCES epics(id) ON DELETE SET NULL,
      column_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      assignee TEXT,
      start_date TEXT,
      due_date TEXT,
      progress INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      color TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id, column_id) REFERENCES columns(project_id, id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_tags (
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      PRIMARY KEY (task_id, tag)
    );

    CREATE TABLE IF NOT EXISTS task_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      url TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'other'
    );

    CREATE TABLE IF NOT EXISTS task_dependencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'finish-to-start'
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      notes TEXT DEFAULT '',
      pomodoros_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_tasks (
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      PRIMARY KEY (session_id, task_id)
    );

    CREATE TABLE IF NOT EXISTS diagrams (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      mermaid_code TEXT DEFAULT '',
      nodes TEXT DEFAULT '[]',
      edges TEXT DEFAULT '[]',
      revision INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function createTroubleshootingSchema(db: BetterSqliteDatabase): void {
  if (!columnExists(db, "diagrams", "revision")) {
    db.exec("ALTER TABLE diagrams ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS diagram_nodes (
      diagram_id TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      node_id TEXT NOT NULL,
      node_type TEXT NOT NULL,
      label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      owner TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      documentation_links_json TEXT NOT NULL DEFAULT '[]',
      dashboard_links_json TEXT NOT NULL DEFAULT '[]',
      log_links_json TEXT NOT NULL DEFAULT '[]',
      trace_links_json TEXT NOT NULL DEFAULT '[]',
      runbook_links_json TEXT NOT NULL DEFAULT '[]',
      known_failure_modes_json TEXT NOT NULL DEFAULT '[]',
      notes_markdown TEXT NOT NULL DEFAULT '',
      attachments_json TEXT NOT NULL DEFAULT '[]',
      last_verified_at TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (diagram_id, node_id)
    );

    CREATE INDEX IF NOT EXISTS idx_diagram_nodes_owner ON diagram_nodes(owner);
    CREATE INDEX IF NOT EXISTS idx_diagram_nodes_label ON diagram_nodes(label);

    CREATE TABLE IF NOT EXISTS diagram_edges (
      diagram_id TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      edge_id TEXT NOT NULL,
      source_node_id TEXT NOT NULL,
      target_node_id TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      relationship_type TEXT NOT NULL DEFAULT '',
      protocol TEXT NOT NULL DEFAULT '',
      auth_assumptions TEXT NOT NULL DEFAULT '',
      dependency_notes TEXT NOT NULL DEFAULT '',
      known_failure_modes_json TEXT NOT NULL DEFAULT '[]',
      evidence_references_json TEXT NOT NULL DEFAULT '[]',
      notes_markdown TEXT NOT NULL DEFAULT '',
      comments_markdown TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (diagram_id, edge_id)
    );

    CREATE INDEX IF NOT EXISTS idx_diagram_edges_source_target ON diagram_edges(diagram_id, source_node_id, target_node_id);
    CREATE INDEX IF NOT EXISTS idx_diagram_edges_protocol ON diagram_edges(protocol);

    CREATE TABLE IF NOT EXISTS troubleshooting_sessions (
      id TEXT PRIMARY KEY,
      diagram_id TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      system_scope TEXT,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL,
      notes_markdown TEXT NOT NULL DEFAULT '',
      hypotheses_json TEXT NOT NULL DEFAULT '[]',
      ai_transcript_references_json TEXT NOT NULL DEFAULT '[]',
      resolution_summary TEXT NOT NULL DEFAULT '',
      reusable_pattern_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_troubleshooting_sessions_diagram ON troubleshooting_sessions(diagram_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_troubleshooting_sessions_status ON troubleshooting_sessions(status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS troubleshooting_session_nodes (
      session_id TEXT NOT NULL REFERENCES troubleshooting_sessions(id) ON DELETE CASCADE,
      node_id TEXT NOT NULL,
      PRIMARY KEY (session_id, node_id)
    );

    CREATE INDEX IF NOT EXISTS idx_troubleshooting_session_nodes_node ON troubleshooting_session_nodes(node_id, session_id);

    CREATE TABLE IF NOT EXISTS troubleshooting_session_edges (
      session_id TEXT NOT NULL REFERENCES troubleshooting_sessions(id) ON DELETE CASCADE,
      edge_id TEXT NOT NULL,
      PRIMARY KEY (session_id, edge_id)
    );

    CREATE INDEX IF NOT EXISTS idx_troubleshooting_session_edges_edge ON troubleshooting_session_edges(edge_id, session_id);

    CREATE TABLE IF NOT EXISTS troubleshooting_timeline_entries (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES troubleshooting_sessions(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS troubleshooting_comments (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES troubleshooting_sessions(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS troubleshooting_commands (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES troubleshooting_sessions(id) ON DELETE CASCADE,
      command TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      output_excerpt TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_patterns (
      id TEXT PRIMARY KEY,
      source_session_id TEXT NOT NULL REFERENCES troubleshooting_sessions(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      symptom TEXT NOT NULL,
      resolution TEXT NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]',
      linked_node_ids_json TEXT NOT NULL DEFAULT '[]',
      linked_edge_ids_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_patterns_updated ON knowledge_patterns(updated_at DESC);

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      owner_type TEXT NOT NULL,
      diagram_id TEXT REFERENCES diagrams(id) ON DELETE CASCADE,
      owner_id TEXT NOT NULL,
      label TEXT NOT NULL,
      file_name TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_artifacts_owner ON artifacts(owner_type, owner_id, created_at DESC);
  `);
}

function runMigrations(db: BetterSqliteDatabase): void {
  ensureMigrationTable(db);

  const applied = new Set(
    (db.prepare("SELECT id FROM schema_migrations ORDER BY id").all() as Array<{ id: string }>).map(
      (entry) => entry.id
    )
  );

  const migrations: Array<{ id: string; run: (database: BetterSqliteDatabase) => void }> = [
    {
      id: "0001_base_schema",
      run: (database) => createBaseSchema(database),
    },
    {
      id: "0002_columns_composite_primary_key",
      run: (database) => applyColumnsCompositePrimaryKeyMigration(database),
    },
    {
      id: "0003_troubleshooting_foundation",
      run: (database) => createTroubleshootingSchema(database),
    },
  ];

  const insertMigration = db.prepare(
    "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)"
  );

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    db.transaction(() => {
      migration.run(db);
      insertMigration.run(migration.id, new Date().toISOString());
    })();
  }
}

export function getPlanViewDb(): BetterSqliteDatabase {
  if (singletonDb) return singletonDb;

  const dbPath = resolvePlanViewDbPath();
  ensureDir(path.dirname(dbPath));
  ensureDir(resolvePlanViewArtifactsDir());

  singletonDb = new DatabaseConstructor(dbPath, {
    nativeBinding: betterSqliteNativeBindingPath,
  });
  singletonDb.pragma("journal_mode = WAL");
  singletonDb.pragma("foreign_keys = ON");
  singletonDb.pragma("busy_timeout = 5000");
  runMigrations(singletonDb);
  rebuildDiagramCatalogTables(singletonDb);
  return singletonDb;
}

export function closePlanViewDb(): void {
  if (singletonDb) {
    singletonDb.close();
    singletonDb = null;
  }
}

function assertMermaidIsSupported(mermaidCode: string): void {
  const diagnostics = validateMermaidDocument(mermaidCode);
  if (diagnostics.length > 0) {
    throw new PlanViewError("invalid_mermaid", "Mermaid contains unsupported or invalid syntax.", {
      status: 400,
      details: { diagnostics },
    });
  }
}

function assertSafeGraphWrite(
  nodesJson: string,
  edgesJson: string,
  updatedAt: string,
  label: string
): { normalizedNodes: DiagramDocument["nodes"]; normalizedEdges: DiagramDocument["edges"] } {
  const graph = normalizeDiagramGraph(nodesJson, edgesJson, updatedAt, label);
  if (graph.warnings.length > 0) {
    throw new PlanViewError("invalid_diagram_graph", "Diagram graph payload failed validation.", {
      status: 400,
      details: { warnings: graph.warnings },
    });
  }
  return {
    normalizedNodes: graph.value.nodes,
    normalizedEdges: graph.value.edges,
  };
}

function upsertDiagramCatalogRows(
  db: BetterSqliteDatabase,
  diagramId: string,
  nodes: DiagramDocument["nodes"],
  edges: DiagramDocument["edges"]
): void {
  db.prepare("DELETE FROM diagram_nodes WHERE diagram_id = ?").run(diagramId);
  db.prepare("DELETE FROM diagram_edges WHERE diagram_id = ?").run(diagramId);

  const insertNode = db.prepare(`
    INSERT INTO diagram_nodes (
      diagram_id, node_id, node_type, label, description, owner, tags_json,
      documentation_links_json, dashboard_links_json, log_links_json, trace_links_json,
      runbook_links_json, known_failure_modes_json, notes_markdown, attachments_json,
      last_verified_at, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEdge = db.prepare(`
    INSERT INTO diagram_edges (
      diagram_id, edge_id, source_node_id, target_node_id, label, relationship_type,
      protocol, auth_assumptions, dependency_notes, known_failure_modes_json,
      evidence_references_json, notes_markdown, comments_markdown, metadata_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const node of nodes) {
    const metadata = node.data.metadata as DiagramNodeMetadata;
    insertNode.run(
      diagramId,
      node.id,
      node.type,
      metadata.title,
      metadata.description,
      metadata.owner,
      JSON.stringify(metadata.tags),
      JSON.stringify(metadata.documentationLinks),
      JSON.stringify(metadata.dashboardLinks),
      JSON.stringify(metadata.logLinks),
      JSON.stringify(metadata.traceLinks),
      JSON.stringify(metadata.runbookLinks),
      JSON.stringify(metadata.knownFailureModes),
      metadata.notesMarkdown,
      JSON.stringify(metadata.attachments),
      metadata.lastVerifiedAt ?? null,
      JSON.stringify(metadata),
      metadata.createdAt,
      metadata.updatedAt
    );
  }

  for (const edge of edges) {
    const metadata = (edge.data?.metadata ?? {}) as DiagramEdgeMetadata;
    insertEdge.run(
      diagramId,
      edge.id,
      edge.source,
      edge.target,
      typeof edge.data?.label === "string" ? edge.data.label : edge.label ?? "",
      metadata.relationshipType ?? "",
      metadata.protocol ?? "",
      metadata.authAssumptions ?? "",
      metadata.dependencyNotes ?? "",
      JSON.stringify(metadata.knownFailureModes ?? []),
      JSON.stringify(metadata.evidenceReferences ?? []),
      metadata.notesMarkdown ?? "",
      metadata.commentsMarkdown ?? "",
      JSON.stringify(metadata),
      metadata.createdAt ?? new Date().toISOString(),
      metadata.updatedAt ?? new Date().toISOString()
    );
  }
}

function rebuildDiagramCatalogTables(db: BetterSqliteDatabase): void {
  const diagrams = db
    .prepare("SELECT * FROM diagrams ORDER BY updated_at DESC")
    .all() as Array<Record<string, unknown>>;

  const apply = db.transaction(() => {
    for (const row of diagrams) {
      const diagram = hydrateDiagramDocument(
        row as {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
          nodes?: string | null;
          edges?: string | null;
        },
        `diagram ${String(row.id)}`
      );
      upsertDiagramCatalogRows(db, diagram.id, diagram.nodes, diagram.edges);
    }
  });

  apply();
}

function diagramSummarySelect(): string {
  return `
    d.id,
    d.project_id,
    d.name,
    d.description,
    d.revision,
    d.created_at,
    d.updated_at,
    COALESCE((SELECT COUNT(*) FROM diagram_nodes dn WHERE dn.diagram_id = d.id), 0) AS node_count,
    COALESCE((SELECT COUNT(*) FROM diagram_edges de WHERE de.diagram_id = d.id), 0) AS edge_count,
    COALESCE((SELECT COUNT(*) FROM troubleshooting_sessions ts WHERE ts.diagram_id = d.id), 0) AS session_count,
    COALESCE((SELECT COUNT(*) FROM troubleshooting_sessions ts WHERE ts.diagram_id = d.id AND ts.status = 'open'), 0) AS open_session_count
  `;
}

export function listPlanViewDiagrams(db = getPlanViewDb()): DiagramSummary[] {
  const rows = db
    .prepare(`SELECT ${diagramSummarySelect()} FROM diagrams d ORDER BY d.updated_at DESC`)
    .all() as Array<{
      id: string;
      project_id?: string | null;
      name: string;
      description?: string | null;
      revision?: number | null;
      created_at: string;
      updated_at: string;
      node_count?: number | null;
      edge_count?: number | null;
      session_count?: number | null;
      open_session_count?: number | null;
    }>;

  return rows.map((row) => createDiagramSummary(row));
}

export function getPlanViewDiagramById(id: string, db = getPlanViewDb()): DiagramDocument | null {
  const row = db
    .prepare(`SELECT ${diagramSummarySelect()}, d.mermaid_code, d.nodes, d.edges FROM diagrams d WHERE d.id = ?`)
    .get(id) as
    | {
        id: string;
        project_id?: string | null;
        name: string;
        description?: string | null;
        revision?: number | null;
        created_at: string;
        updated_at: string;
        node_count?: number | null;
        edge_count?: number | null;
        session_count?: number | null;
        open_session_count?: number | null;
        mermaid_code?: string | null;
        nodes?: string | null;
        edges?: string | null;
      }
    | undefined;

  if (!row) return null;
  return hydrateDiagramDocument(row, `diagram ${id}`);
}

type DiagramWriteInput = {
  id: string;
  projectId?: string | null;
  name: string;
  description: string;
  mermaidCode: string;
  nodes: DiagramDocument["nodes"];
  edges: DiagramDocument["edges"];
  createdAt: string;
  expectedRevision?: number;
};

function persistDiagramDocument(
  db: BetterSqliteDatabase,
  input: DiagramWriteInput
): DiagramDocument {
  assertMermaidIsSupported(input.mermaidCode);

  const now = new Date().toISOString();
  const candidateNodesJson = JSON.stringify(input.nodes);
  const candidateEdgesJson = JSON.stringify(input.edges);
  const { normalizedNodes, normalizedEdges } = assertSafeGraphWrite(
    candidateNodesJson,
    candidateEdgesJson,
    now,
    `diagram ${input.id}`
  );
  const nodesJson = JSON.stringify(normalizedNodes);
  const edgesJson = JSON.stringify(normalizedEdges);

  const existing = db
    .prepare("SELECT id, project_id, created_at, revision FROM diagrams WHERE id = ?")
    .get(input.id) as
    | { id: string; project_id?: string | null; created_at: string; revision: number }
    | undefined;

  if (existing && input.expectedRevision !== undefined && existing.revision !== input.expectedRevision) {
    throw new PlanViewError("diagram_revision_conflict", "Diagram has been updated elsewhere.", {
      status: 409,
      details: {
        diagramId: input.id,
        expectedRevision: input.expectedRevision,
        actualRevision: existing.revision,
      },
    });
  }

  const revision = existing ? existing.revision + 1 : 1;
  const createdAt = existing?.created_at ?? input.createdAt ?? now;
  const projectId = input.projectId !== undefined ? input.projectId : existing?.project_id ?? null;

  db.prepare(`
    INSERT INTO diagrams (
      id, project_id, name, description, mermaid_code, nodes, edges, revision, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      project_id = excluded.project_id,
      name = excluded.name,
      description = excluded.description,
      mermaid_code = excluded.mermaid_code,
      nodes = excluded.nodes,
      edges = excluded.edges,
      revision = excluded.revision,
      updated_at = excluded.updated_at
  `).run(
    input.id,
    projectId ?? null,
    input.name,
    input.description,
    input.mermaidCode,
    nodesJson,
    edgesJson,
    revision,
    createdAt,
    now
  );

  upsertDiagramCatalogRows(db, input.id, normalizedNodes, normalizedEdges);
  return getPlanViewDiagramById(input.id, db)!;
}

export function savePlanViewDiagram(
  input: DiagramWriteInput,
  db = getPlanViewDb()
): DiagramDocument {
  try {
    return db.transaction(() => persistDiagramDocument(db, input))();
  } catch (error) {
    throw asPlanViewError(error);
  }
}

export function deletePlanViewDiagram(id: string, db = getPlanViewDb()): boolean {
  const result = db.prepare("DELETE FROM diagrams WHERE id = ?").run(id);
  return result.changes > 0;
}

export function updatePlanViewNodeMetadata(
  diagramId: string,
  nodeId: string,
  metadata: DiagramNodeMetadata,
  expectedRevision?: number,
  db = getPlanViewDb()
): DiagramDocument {
  try {
    return db.transaction(() => {
      const diagram = getPlanViewDiagramById(diagramId, db);
      if (!diagram) {
        throw new PlanViewError("diagram_not_found", `Diagram not found: ${diagramId}`, {
          status: 404,
        });
      }

      const nextNodes = diagram.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                label: metadata.title,
                description: metadata.description,
                metadata,
              },
            }
          : node
      );

      const matched = nextNodes.some((node) => node.id === nodeId);
      if (!matched) {
        throw new PlanViewError("node_not_found", `Diagram node not found: ${nodeId}`, {
          status: 404,
        });
      }

      return persistDiagramDocument(db, {
        id: diagram.id,
        projectId: diagram.projectId,
        name: diagram.name,
        description: diagram.description,
        mermaidCode: flowToMermaid(nextNodes, diagram.edges),
        nodes: nextNodes,
        edges: diagram.edges,
        createdAt: diagram.createdAt,
        expectedRevision: expectedRevision ?? diagram.revision,
      });
    })();
  } catch (error) {
    throw asPlanViewError(error);
  }
}

export function updatePlanViewEdgeMetadata(
  diagramId: string,
  edgeId: string,
  metadata: DiagramEdgeMetadata,
  expectedRevision?: number,
  db = getPlanViewDb()
): DiagramDocument {
  try {
    return db.transaction(() => {
      const diagram = getPlanViewDiagramById(diagramId, db);
      if (!diagram) {
        throw new PlanViewError("diagram_not_found", `Diagram not found: ${diagramId}`, {
          status: 404,
        });
      }

      const nextEdges = diagram.edges.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              label: edge.label ?? (edge.data?.label as string | undefined),
              data: {
                ...(edge.data ?? {}),
                metadata,
              },
            }
          : edge
      );

      const matched = nextEdges.some((edge) => edge.id === edgeId);
      if (!matched) {
        throw new PlanViewError("edge_not_found", `Diagram edge not found: ${edgeId}`, {
          status: 404,
        });
      }

      return persistDiagramDocument(db, {
        id: diagram.id,
        projectId: diagram.projectId,
        name: diagram.name,
        description: diagram.description,
        mermaidCode: flowToMermaid(diagram.nodes, nextEdges),
        nodes: diagram.nodes,
        edges: nextEdges,
        createdAt: diagram.createdAt,
        expectedRevision: expectedRevision ?? diagram.revision,
      });
    })();
  } catch (error) {
    throw asPlanViewError(error);
  }
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function parseJsonValue<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function hydrateArtifactRow(row: ArtifactRow): PlanViewArtifactRecord {
  return {
    id: row.id,
    artifactId: row.id,
    ownerType: row.owner_type,
    diagramId: row.diagram_id ?? null,
    ownerId: row.owner_id,
    label: row.label,
    fileName: row.file_name,
    relativePath: row.relative_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    checksumSha256: row.checksum_sha256,
    createdAt: row.created_at,
  };
}

function resolveArtifactAbsolutePath(relativePath: string): string {
  const root = path.resolve(resolvePlanViewArtifactsDir());
  const absolutePath = path.resolve(root, relativePath);
  const safePrefix = `${root}${path.sep}`;
  if (absolutePath !== root && !absolutePath.startsWith(safePrefix)) {
    throw new PlanViewError("artifact_path_invalid", "Artifact path resolves outside the configured artifact directory.", {
      status: 500,
      details: { relativePath },
    });
  }
  return absolutePath;
}

function listSessionTimelineEntries(sessionId: string, db: BetterSqliteDatabase): SessionTimelineEntry[] {
  const rows = db
    .prepare(`
      SELECT id, kind, title, body, author, occurred_at, created_at
      FROM troubleshooting_timeline_entries
      WHERE session_id = ?
      ORDER BY occurred_at ASC, created_at ASC
    `)
    .all(sessionId) as Array<{
    id: string;
    kind: string;
    title: string;
    body: string;
    author: string;
    occurred_at: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as SessionTimelineEntry["kind"],
    title: row.title,
    body: row.body,
    author: row.author,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  }));
}

function listSessionComments(sessionId: string, db: BetterSqliteDatabase): SessionComment[] {
  const rows = db
    .prepare(`
      SELECT id, author, body, created_at, updated_at
      FROM troubleshooting_comments
      WHERE session_id = ?
      ORDER BY created_at ASC
    `)
    .all(sessionId) as Array<{
    id: string;
    author: string;
    body: string;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    author: row.author,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function listSessionCommands(sessionId: string, db: BetterSqliteDatabase): SessionCommand[] {
  const rows = db
    .prepare(`
      SELECT id, command, summary, output_excerpt, status, created_at
      FROM troubleshooting_commands
      WHERE session_id = ?
      ORDER BY created_at ASC
    `)
    .all(sessionId) as Array<{
    id: string;
    command: string;
    summary: string;
    output_excerpt: string;
    status: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    command: row.command,
    summary: row.summary,
    outputExcerpt: row.output_excerpt,
    status: row.status as SessionCommand["status"],
    createdAt: row.created_at,
  }));
}

function listSessionArtifacts(sessionId: string, db: BetterSqliteDatabase): ArtifactReference[] {
  const rows = db
    .prepare(`
      SELECT id, label, file_name, relative_path, mime_type, size_bytes, checksum_sha256, created_at
      FROM artifacts
      WHERE owner_type = 'session' AND owner_id = ?
      ORDER BY created_at DESC
    `)
    .all(sessionId) as Array<{
    id: string;
    label: string;
    file_name: string;
    relative_path: string;
    mime_type: string;
    size_bytes: number;
    checksum_sha256: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    artifactId: row.id,
    label: row.label,
    fileName: row.file_name,
    relativePath: row.relative_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    checksumSha256: row.checksum_sha256,
    createdAt: row.created_at,
  }));
}

export function listPlanViewArtifacts(
  filters?: {
    ownerType?: ArtifactOwnerType;
    ownerId?: string;
    diagramId?: string;
    q?: string;
    limit?: number;
  },
  db = getPlanViewDb()
): PlanViewArtifactRecord[] {
  const conditions: string[] = [];
  const values: Array<string | number> = [];

  if (filters?.ownerType) {
    conditions.push("owner_type = ?");
    values.push(filters.ownerType);
  }
  if (filters?.ownerId) {
    conditions.push("owner_id = ?");
    values.push(filters.ownerId);
  }
  if (filters?.diagramId) {
    conditions.push("diagram_id = ?");
    values.push(filters.diagramId);
  }
  if (filters?.q) {
    const needle = `%${filters.q.toLowerCase()}%`;
    conditions.push("(LOWER(label) LIKE ? OR LOWER(file_name) LIKE ?)");
    values.push(needle, needle);
  }

  const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);
  values.push(limit);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db.prepare(`
    SELECT id, owner_type, diagram_id, owner_id, label, file_name, relative_path, mime_type, size_bytes, checksum_sha256, created_at
    FROM artifacts
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ?
  `).all(...values) as ArtifactRow[];

  return rows.map(hydrateArtifactRow);
}

export function getPlanViewArtifactById(
  artifactId: string,
  db = getPlanViewDb()
): PlanViewArtifactFile | null {
  const row = db.prepare(`
    SELECT id, owner_type, diagram_id, owner_id, label, file_name, relative_path, mime_type, size_bytes, checksum_sha256, created_at
    FROM artifacts
    WHERE id = ?
  `).get(artifactId) as ArtifactRow | undefined;

  if (!row) {
    return null;
  }

  const absolutePath = resolveArtifactAbsolutePath(row.relative_path);
  if (!fs.existsSync(absolutePath)) {
    throw new PlanViewError("artifact_missing", `Artifact file not found for ${artifactId}.`, {
      status: 404,
      details: { artifactId, relativePath: row.relative_path },
    });
  }

  return {
    ...hydrateArtifactRow(row),
    absolutePath,
  };
}

function hydrateTroubleshootingSession(row: SessionRow, db: BetterSqliteDatabase): TroubleshootingSession {
  const linkedNodeRows = db
    .prepare("SELECT node_id FROM troubleshooting_session_nodes WHERE session_id = ? ORDER BY node_id")
    .all(row.id) as Array<{ node_id: string }>;
  const linkedEdgeRows = db
    .prepare("SELECT edge_id FROM troubleshooting_session_edges WHERE session_id = ? ORDER BY edge_id")
    .all(row.id) as Array<{ edge_id: string }>;

  return {
    id: row.id,
    diagramId: row.diagram_id,
    projectId: row.project_id ?? null,
    systemScope: row.system_scope ?? undefined,
    title: row.title,
    summary: row.summary,
    status: row.status as TroubleshootingSession["status"],
    linkedNodeIds: linkedNodeRows.map((entry) => entry.node_id),
    linkedEdgeIds: linkedEdgeRows.map((entry) => entry.edge_id),
    timelineEntries: listSessionTimelineEntries(row.id, db),
    notesMarkdown: row.notes_markdown ?? "",
    hypotheses: parseJsonArray(row.hypotheses_json),
    commands: listSessionCommands(row.id, db),
    aiTranscriptReferences: parseJsonValue(row.ai_transcript_references_json, []),
    artifacts: listSessionArtifacts(row.id, db),
    comments: listSessionComments(row.id, db),
    resolutionSummary: row.resolution_summary ?? "",
    reusablePatternId: row.reusable_pattern_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at ?? undefined,
  };
}

type SessionCreateInput = Omit<
  TroubleshootingSession,
  "id" | "timelineEntries" | "commands" | "comments" | "artifacts" | "createdAt" | "updatedAt"
> & {
  id?: string;
  timelineEntries?: SessionTimelineEntry[];
  commands?: SessionCommand[];
  comments?: SessionComment[];
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
};

type SessionPatchInput = Partial<
  Pick<
    TroubleshootingSession,
    | "title"
    | "summary"
    | "status"
    | "linkedNodeIds"
    | "linkedEdgeIds"
    | "notesMarkdown"
    | "hypotheses"
    | "aiTranscriptReferences"
    | "resolutionSummary"
  >
>;

function upsertSessionLinks(
  db: BetterSqliteDatabase,
  sessionId: string,
  linkedNodeIds: string[],
  linkedEdgeIds: string[]
): void {
  db.prepare("DELETE FROM troubleshooting_session_nodes WHERE session_id = ?").run(sessionId);
  db.prepare("DELETE FROM troubleshooting_session_edges WHERE session_id = ?").run(sessionId);

  const insertNode = db.prepare(
    "INSERT OR IGNORE INTO troubleshooting_session_nodes (session_id, node_id) VALUES (?, ?)"
  );
  const insertEdge = db.prepare(
    "INSERT OR IGNORE INTO troubleshooting_session_edges (session_id, edge_id) VALUES (?, ?)"
  );

  for (const nodeId of linkedNodeIds) {
    insertNode.run(sessionId, nodeId);
  }
  for (const edgeId of linkedEdgeIds) {
    insertEdge.run(sessionId, edgeId);
  }
}

function getSessionRow(sessionId: string, db: BetterSqliteDatabase): SessionRow | null {
  const row = db
    .prepare("SELECT * FROM troubleshooting_sessions WHERE id = ?")
    .get(sessionId) as SessionRow | undefined;
  return row ?? null;
}

export function getPlanViewTroubleshootingSessionById(
  sessionId: string,
  db = getPlanViewDb()
): TroubleshootingSession | null {
  const row = getSessionRow(sessionId, db);
  if (!row) return null;
  return hydrateTroubleshootingSession(row, db);
}

export function listPlanViewTroubleshootingSessions(
  filters?: { diagramId?: string; nodeId?: string; edgeId?: string; q?: string },
  db = getPlanViewDb()
): TroubleshootingSession[] {
  const conditions: string[] = [];
  const values: Array<string> = [];

  if (filters?.diagramId) {
    conditions.push("ts.diagram_id = ?");
    values.push(filters.diagramId);
  }
  if (filters?.nodeId) {
    conditions.push("EXISTS (SELECT 1 FROM troubleshooting_session_nodes sn WHERE sn.session_id = ts.id AND sn.node_id = ?)");
    values.push(filters.nodeId);
  }
  if (filters?.edgeId) {
    conditions.push("EXISTS (SELECT 1 FROM troubleshooting_session_edges se WHERE se.session_id = ts.id AND se.edge_id = ?)");
    values.push(filters.edgeId);
  }
  if (filters?.q) {
    const needle = `%${filters.q.toLowerCase()}%`;
    conditions.push(
      "(LOWER(ts.title) LIKE ? OR LOWER(ts.summary) LIKE ? OR LOWER(ts.notes_markdown) LIKE ? OR LOWER(ts.resolution_summary) LIKE ?)"
    );
    values.push(needle, needle, needle, needle);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT ts.* FROM troubleshooting_sessions ts ${whereClause} ORDER BY ts.updated_at DESC`)
    .all(...values) as SessionRow[];

  return rows.map((row) => hydrateTroubleshootingSession(row, db));
}

export function createPlanViewTroubleshootingSession(
  input: SessionCreateInput,
  db = getPlanViewDb()
): TroubleshootingSession {
  try {
    return db.transaction(() => {
      const diagram = getPlanViewDiagramById(input.diagramId, db);
      if (!diagram) {
        throw new PlanViewError("diagram_not_found", `Diagram not found: ${input.diagramId}`, {
          status: 404,
        });
      }

      const now = new Date().toISOString();
      const sessionId = input.id || crypto.randomUUID();
      db.prepare(`
        INSERT INTO troubleshooting_sessions (
          id, diagram_id, project_id, system_scope, title, summary, status, notes_markdown,
          hypotheses_json, ai_transcript_references_json, resolution_summary, created_at, updated_at, resolved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        input.diagramId,
        input.projectId ?? diagram.projectId ?? null,
        input.systemScope ?? null,
        input.title,
        input.summary,
        input.status,
        input.notesMarkdown,
        JSON.stringify(input.hypotheses),
        JSON.stringify(input.aiTranscriptReferences),
        input.resolutionSummary,
        input.createdAt || now,
        input.updatedAt || now,
        input.status === "resolved" ? input.resolvedAt ?? now : null
      );

      upsertSessionLinks(db, sessionId, input.linkedNodeIds, input.linkedEdgeIds);

      for (const entry of input.timelineEntries ?? []) {
        appendPlanViewTimelineEntry(sessionId, entry, db);
      }
      for (const comment of input.comments ?? []) {
        appendPlanViewSessionComment(sessionId, comment, db);
      }
      for (const command of input.commands ?? []) {
        appendPlanViewSessionCommand(sessionId, command, db);
      }

      return getPlanViewTroubleshootingSessionById(sessionId, db)!;
    })();
  } catch (error) {
    throw asPlanViewError(error);
  }
}

export function updatePlanViewTroubleshootingSession(
  sessionId: string,
  patch: SessionPatchInput,
  db = getPlanViewDb()
): TroubleshootingSession {
  try {
    return db.transaction(() => {
      const row = getSessionRow(sessionId, db);
      if (!row) {
        throw new PlanViewError("session_not_found", `Troubleshooting session not found: ${sessionId}`, {
          status: 404,
        });
      }

      const updatedAt = new Date().toISOString();
      const nextStatus = patch.status ?? (row.status as TroubleshootingSession["status"]);
      db.prepare(`
        UPDATE troubleshooting_sessions
        SET title = ?, summary = ?, status = ?, notes_markdown = ?, hypotheses_json = ?,
            ai_transcript_references_json = ?, resolution_summary = ?, updated_at = ?, resolved_at = ?
        WHERE id = ?
      `).run(
        patch.title ?? row.title,
        patch.summary ?? row.summary,
        nextStatus,
        patch.notesMarkdown ?? row.notes_markdown ?? "",
        JSON.stringify(patch.hypotheses ?? parseJsonArray(row.hypotheses_json)),
        JSON.stringify(patch.aiTranscriptReferences ?? parseJsonValue(row.ai_transcript_references_json, [])),
        patch.resolutionSummary ?? row.resolution_summary ?? "",
        updatedAt,
        nextStatus === "resolved" ? row.resolved_at ?? updatedAt : null,
        sessionId
      );

      upsertSessionLinks(
        db,
        sessionId,
        patch.linkedNodeIds ?? (
          db
            .prepare("SELECT node_id FROM troubleshooting_session_nodes WHERE session_id = ? ORDER BY node_id")
            .all(sessionId) as Array<{ node_id: string }>
        ).map((entry) => entry.node_id),
        patch.linkedEdgeIds ?? (
          db
            .prepare("SELECT edge_id FROM troubleshooting_session_edges WHERE session_id = ? ORDER BY edge_id")
            .all(sessionId) as Array<{ edge_id: string }>
        ).map((entry) => entry.edge_id)
      );

      return getPlanViewTroubleshootingSessionById(sessionId, db)!;
    })();
  } catch (error) {
    throw asPlanViewError(error);
  }
}

export function appendPlanViewTimelineEntry(
  sessionId: string,
  entry: Omit<SessionTimelineEntry, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
  db = getPlanViewDb()
): SessionTimelineEntry {
  try {
    const session = getSessionRow(sessionId, db);
    if (!session) {
      throw new PlanViewError("session_not_found", `Troubleshooting session not found: ${sessionId}`, {
        status: 404,
      });
    }

    const createdAt = entry.createdAt ?? new Date().toISOString();
    const id = entry.id || crypto.randomUUID();
    db.prepare(`
      INSERT INTO troubleshooting_timeline_entries (
        id, session_id, kind, title, body, author, occurred_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, sessionId, entry.kind, entry.title, entry.body, entry.author, entry.occurredAt, createdAt);

    db.prepare("UPDATE troubleshooting_sessions SET updated_at = ? WHERE id = ?").run(createdAt, sessionId);
    return {
      ...entry,
      id,
      createdAt,
    };
  } catch (error) {
    throw asPlanViewError(error);
  }
}

export function appendPlanViewSessionComment(
  sessionId: string,
  comment: Omit<SessionComment, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
  },
  db = getPlanViewDb()
): SessionComment {
  try {
    const session = getSessionRow(sessionId, db);
    if (!session) {
      throw new PlanViewError("session_not_found", `Troubleshooting session not found: ${sessionId}`, {
        status: 404,
      });
    }

    const createdAt = comment.createdAt ?? new Date().toISOString();
    const updatedAt = comment.updatedAt ?? createdAt;
    const id = comment.id || crypto.randomUUID();
    db.prepare(`
      INSERT INTO troubleshooting_comments (id, session_id, author, body, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, sessionId, comment.author, comment.body, createdAt, updatedAt);

    db.prepare("UPDATE troubleshooting_sessions SET updated_at = ? WHERE id = ?").run(updatedAt, sessionId);
    return {
      id,
      author: comment.author,
      body: comment.body,
      createdAt,
      updatedAt,
    };
  } catch (error) {
    throw asPlanViewError(error);
  }
}

export function appendPlanViewSessionCommand(
  sessionId: string,
  command: Omit<SessionCommand, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
  db = getPlanViewDb()
): SessionCommand {
  try {
    const session = getSessionRow(sessionId, db);
    if (!session) {
      throw new PlanViewError("session_not_found", `Troubleshooting session not found: ${sessionId}`, {
        status: 404,
      });
    }

    const createdAt = command.createdAt ?? new Date().toISOString();
    const id = command.id || crypto.randomUUID();
    db.prepare(`
      INSERT INTO troubleshooting_commands (id, session_id, command, summary, output_excerpt, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, sessionId, command.command, command.summary, command.outputExcerpt, command.status, createdAt);

    db.prepare("UPDATE troubleshooting_sessions SET updated_at = ? WHERE id = ?").run(createdAt, sessionId);
    return {
      ...command,
      id,
      createdAt,
    };
  } catch (error) {
    throw asPlanViewError(error);
  }
}

export function extractPlanViewKnowledgePattern(
  sessionId: string,
  input: Omit<KnowledgePattern, "id" | "sourceSessionId" | "createdAt" | "updatedAt">,
  db = getPlanViewDb()
): KnowledgePattern {
  try {
    return db.transaction(() => {
      const session = getPlanViewTroubleshootingSessionById(sessionId, db);
      if (!session) {
        throw new PlanViewError("session_not_found", `Troubleshooting session not found: ${sessionId}`, {
          status: 404,
        });
      }

      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO knowledge_patterns (
          id, source_session_id, title, summary, symptom, resolution, tags_json,
          linked_node_ids_json, linked_edge_ids_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        sessionId,
        input.title,
        input.summary,
        input.symptom,
        input.resolution,
        JSON.stringify(input.tags),
        JSON.stringify(input.linkedNodeIds),
        JSON.stringify(input.linkedEdgeIds),
        now,
        now
      );

      db.prepare(
        "UPDATE troubleshooting_sessions SET reusable_pattern_id = ?, updated_at = ? WHERE id = ?"
      ).run(id, now, sessionId);

      return {
        id,
        sourceSessionId: sessionId,
        title: input.title,
        summary: input.summary,
        symptom: input.symptom,
        resolution: input.resolution,
        tags: input.tags,
        linkedNodeIds: input.linkedNodeIds,
        linkedEdgeIds: input.linkedEdgeIds,
        createdAt: now,
        updatedAt: now,
      };
    })();
  } catch (error) {
    throw asPlanViewError(error);
  }
}

export function listPlanViewKnowledgePatterns(db = getPlanViewDb()): KnowledgePattern[] {
  const rows = db
    .prepare(`
      SELECT id, source_session_id, title, summary, symptom, resolution,
             tags_json, linked_node_ids_json, linked_edge_ids_json, created_at, updated_at
      FROM knowledge_patterns
      ORDER BY updated_at DESC
    `)
    .all() as Array<{
    id: string;
    source_session_id: string;
    title: string;
    summary: string;
    symptom: string;
    resolution: string;
    tags_json?: string | null;
    linked_node_ids_json?: string | null;
    linked_edge_ids_json?: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    sourceSessionId: row.source_session_id,
    title: row.title,
    summary: row.summary,
    symptom: row.symptom,
    resolution: row.resolution,
    tags: parseJsonArray(row.tags_json),
    linkedNodeIds: parseJsonArray(row.linked_node_ids_json),
    linkedEdgeIds: parseJsonArray(row.linked_edge_ids_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function searchPlanViewTroubleshootingMemory(
  filters: { q: string; diagramId?: string; nodeId?: string; edgeId?: string; limit?: number },
  db = getPlanViewDb()
): TroubleshootingSearchHit[] {
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
  const normalizedQuery = filters.q.trim().toLowerCase();
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }

  const scoreTokenMatches = (
    fields: Array<{ value: string; weight: number }>
  ): number => {
    let score = 0;
    for (const token of tokens) {
      for (const field of fields) {
        const haystack = field.value.toLowerCase();
        if (haystack.includes(token)) {
          score += field.weight;
        }
      }
    }
    return score;
  };

  const sessionMatches = listPlanViewTroubleshootingSessions(
    {
      diagramId: filters.diagramId,
      nodeId: filters.nodeId,
      edgeId: filters.edgeId,
    },
    db
  )
    .map<TroubleshootingSearchHit | null>((session) => {
      const score = scoreTokenMatches([
        { value: session.title, weight: 30 },
        { value: session.summary, weight: 26 },
        { value: session.systemScope ?? "", weight: 18 },
        { value: session.notesMarkdown, weight: 16 },
        { value: session.resolutionSummary, weight: 20 },
        { value: session.hypotheses.join("\n"), weight: 14 },
        { value: session.timelineEntries.map((entry) => `${entry.title}\n${entry.body}`).join("\n"), weight: 10 },
        { value: session.comments.map((comment) => comment.body).join("\n"), weight: 9 },
        { value: session.commands.map((command) => `${command.command}\n${command.summary}\n${command.outputExcerpt}`).join("\n"), weight: 9 },
        { value: session.artifacts.map((artifact) => `${artifact.label}\n${artifact.fileName}`).join("\n"), weight: 8 },
      ]);

      const linkedEntityBoost =
        (filters.nodeId && session.linkedNodeIds.includes(filters.nodeId) ? 20 : 0) +
        (filters.edgeId && session.linkedEdgeIds.includes(filters.edgeId) ? 20 : 0) +
        (filters.diagramId && session.diagramId === filters.diagramId ? 8 : 0);

      const finalScore = score + linkedEntityBoost;
      if (finalScore <= 0) {
        return null;
      }

      return {
        type: "session",
        id: session.id,
        title: session.title,
        summary: session.summary,
        diagramId: session.diagramId,
        sessionId: session.id,
        score: finalScore,
        updatedAt: session.updatedAt,
      };
    })
    .filter((hit): hit is TroubleshootingSearchHit => Boolean(hit));

  const patternMatches = listPlanViewKnowledgePatterns(db)
    .map<TroubleshootingSearchHit | null>((pattern) => {
      if (filters.nodeId && !pattern.linkedNodeIds.includes(filters.nodeId)) return null;
      if (filters.edgeId && !pattern.linkedEdgeIds.includes(filters.edgeId)) return null;

      const score = scoreTokenMatches([
        { value: pattern.title, weight: 28 },
        { value: pattern.summary, weight: 24 },
        { value: pattern.symptom, weight: 24 },
        { value: pattern.resolution, weight: 20 },
        { value: pattern.tags.join("\n"), weight: 12 },
      ]);

      const linkedEntityBoost =
        (filters.nodeId && pattern.linkedNodeIds.includes(filters.nodeId) ? 18 : 0) +
        (filters.edgeId && pattern.linkedEdgeIds.includes(filters.edgeId) ? 18 : 0);

      const finalScore = score + linkedEntityBoost;
      if (finalScore <= 0) {
        return null;
      }

      return {
        type: "pattern",
        id: pattern.id,
        title: pattern.title,
        summary: pattern.summary,
        sessionId: pattern.sourceSessionId,
        score: finalScore,
        updatedAt: pattern.updatedAt,
      };
    })
    .filter((hit): hit is TroubleshootingSearchHit => Boolean(hit));

  return [...sessionMatches, ...patternMatches]
    .sort((left, right) => right.score - left.score || right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit);
}

export async function savePlanViewArtifactFile(
  input: {
    ownerType: "node" | "edge" | "session";
    diagramId?: string;
    ownerId: string;
    label?: string;
    fileName: string;
    mimeType: string;
    bytes: Uint8Array;
  },
  db = getPlanViewDb()
): Promise<ArtifactReference> {
  const checksumSha256 = crypto.createHash("sha256").update(input.bytes).digest("hex");
  const id = crypto.randomUUID();
  const extension = path.extname(input.fileName) || "";
  const dayPrefix = new Date().toISOString().slice(0, 10);
  const relativePath = path.join(input.ownerType, dayPrefix, `${id}${extension}`);
  const absolutePath = path.join(resolvePlanViewArtifactsDir(), relativePath);
  ensureDir(path.dirname(absolutePath));
  await fs.promises.writeFile(absolutePath, input.bytes);

  const createdAt = new Date().toISOString();
  const label = input.label?.trim() || input.fileName;
  db.prepare(`
    INSERT INTO artifacts (
      id, owner_type, diagram_id, owner_id, label, file_name,
      relative_path, mime_type, size_bytes, checksum_sha256, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.ownerType,
    input.diagramId ?? null,
    input.ownerId,
    label,
    input.fileName,
    relativePath,
    input.mimeType || "application/octet-stream",
    input.bytes.byteLength,
    checksumSha256,
    createdAt
  );

  if (input.ownerType === "session") {
    db.prepare("UPDATE troubleshooting_sessions SET updated_at = ? WHERE id = ?").run(createdAt, input.ownerId);
  }

  return {
    id,
    artifactId: id,
    label,
    fileName: input.fileName,
    relativePath,
    mimeType: input.mimeType || "application/octet-stream",
    sizeBytes: input.bytes.byteLength,
    checksumSha256,
    createdAt,
  };
}
