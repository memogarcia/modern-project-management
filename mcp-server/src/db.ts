import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type {
  Diagram,
  KanbanProject,
  KanbanColumn,
  KanbanEpic,
  KanbanTask,
  KanbanTaskLink,
  TaskDependency,
  ProjectSession,
} from "./types.js";

// ─── DB Path Resolution ─────────────────────────────────────────────

function resolveDbPath(): string {
  const fromEnv = process.env.PLANVIEW_DB;
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.resolve(process.cwd(), fromEnv);
  }

  const cwd = process.cwd();
  const moduleDir = path.dirname(new URL(import.meta.url).pathname);

  // Running from repo root
  if (fs.existsSync(path.join(cwd, "mcp-server"))) {
    return path.join(cwd, "mcp-server", "data", "planview.db");
  }
  // Running from mcp-server/
  if (fs.existsSync(path.join(cwd, "data")) || fs.existsSync(path.join(cwd, "src"))) {
    return path.join(cwd, "data", "planview.db");
  }
  // Fallback relative to this file
  return path.join(moduleDir, "..", "data", "planview.db");
}

// ─── Singleton Connection ────────────────────────────────────────────

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const dbPath = resolveDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  initSchema(_db);
  return _db;
}

/** Close DB connection (useful for tests). */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ─── Schema ──────────────────────────────────────────────────────────

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS columns (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#94a3b8',
      position INTEGER NOT NULL DEFAULT 0,
      wip_limit INTEGER
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
      column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
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
      updated_at TEXT NOT NULL
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

// ─── Project CRUD ────────────────────────────────────────────────────

export function listProjects(): KanbanProject[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM projects ORDER BY updated_at DESC")
    .all() as any[];

  return rows.map((r) => getProjectById(r.id)!).filter(Boolean);
}

export function listProjectsMeta(): Array<{
  id: string;
  name: string;
  description: string;
  epicCount: number;
  taskCount: number;
  columnCount: number;
  sessionCount: number;
  diagramCount: number;
  updatedAt: string;
}> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.description, p.created_at, p.updated_at,
              (SELECT COUNT(*) FROM epics WHERE project_id = p.id) AS epicCount,
              (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS taskCount,
              (SELECT COUNT(*) FROM columns WHERE project_id = p.id) AS columnCount,
              (SELECT COUNT(*) FROM sessions WHERE project_id = p.id) AS sessionCount,
              (SELECT COUNT(*) FROM diagrams WHERE project_id = p.id) AS diagramCount
       FROM projects p ORDER BY p.updated_at DESC`
    )
    .all() as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    epicCount: r.epicCount,
    taskCount: r.taskCount,
    columnCount: r.columnCount,
    sessionCount: r.sessionCount,
    diagramCount: r.diagramCount,
    updatedAt: r.updated_at,
  }));
}

export function getProjectById(id: string): KanbanProject | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(id) as any;
  if (!row) return null;

  const columns = db
    .prepare("SELECT * FROM columns WHERE project_id = ? ORDER BY position")
    .all(id) as any[];

  const epics = db
    .prepare("SELECT * FROM epics WHERE project_id = ? ORDER BY created_at")
    .all(id) as any[];

  const taskRows = db
    .prepare("SELECT * FROM tasks WHERE project_id = ? ORDER BY position")
    .all(id) as any[];

  const tasks: KanbanTask[] = taskRows.map((t: any) => {
    const tags = db
      .prepare("SELECT tag FROM task_tags WHERE task_id = ?")
      .all(t.id) as any[];
    const links = db
      .prepare("SELECT label, url, type FROM task_links WHERE task_id = ?")
      .all(t.id) as any[];
    const deps = db
      .prepare(
        "SELECT depends_on_task_id AS taskId, type FROM task_dependencies WHERE task_id = ?"
      )
      .all(t.id) as any[];

    return {
      id: t.id,
      epicId: t.epic_id ?? "",
      columnId: t.column_id,
      name: t.name,
      description: t.description ?? undefined,
      priority: t.priority,
      assignee: t.assignee ?? undefined,
      tags: tags.map((tg: any) => tg.tag),
      startDate: t.start_date ?? undefined,
      dueDate: t.due_date ?? undefined,
      progress: t.progress,
      position: t.position,
      links: links.map((l: any) => ({
        label: l.label,
        url: l.url,
        type: l.type,
      })),
      dependencies: deps.length
        ? deps.map((d: any) => ({ taskId: d.taskId, type: d.type }))
        : undefined,
      color: t.color ?? undefined,
      metadata: JSON.parse(t.metadata || "{}"),
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    };
  });

  const sessionRows = db
    .prepare("SELECT * FROM sessions WHERE project_id = ? ORDER BY created_at DESC")
    .all(id) as any[];

  const sessions: ProjectSession[] = sessionRows.map((s: any) => {
    const stasks = db
      .prepare("SELECT task_id FROM session_tasks WHERE session_id = ?")
      .all(s.id) as any[];
    return {
      id: s.id,
      title: s.title,
      notes: s.notes ?? "",
      taskIds: stasks.map((st: any) => st.task_id),
      pomodorosCompleted: s.pomodoros_completed,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    };
  });

  const diagramIds = db
    .prepare("SELECT id FROM diagrams WHERE project_id = ?")
    .all(id) as any[];

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    columns: columns.map((c: any) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      position: c.position,
      wipLimit: c.wip_limit ?? undefined,
    })),
    epics: epics.map((e: any) => ({
      id: e.id,
      name: e.name,
      description: e.description ?? undefined,
      color: e.color ?? undefined,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    })),
    tasks,
    sessions,
    diagramIds: diagramIds.map((d: any) => d.id),
  };
}

export function upsertProject(project: KanbanProject): void {
  const db = getDb();
  const now = new Date().toISOString();

  const upsert = db.transaction(() => {
    db.prepare(
      `INSERT INTO projects (id, name, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         updated_at = excluded.updated_at`
    ).run(
      project.id,
      project.name,
      project.description,
      project.createdAt || now,
      project.updatedAt || now
    );

    // Replace columns
    db.prepare("DELETE FROM columns WHERE project_id = ?").run(project.id);
    const insertCol = db.prepare(
      "INSERT INTO columns (id, project_id, name, color, position, wip_limit) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const col of project.columns) {
      insertCol.run(col.id, project.id, col.name, col.color, col.position, col.wipLimit ?? null);
    }

    // Replace epics
    db.prepare("DELETE FROM epics WHERE project_id = ?").run(project.id);
    const insertEpic = db.prepare(
      "INSERT INTO epics (id, project_id, name, description, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    for (const epic of project.epics) {
      insertEpic.run(epic.id, project.id, epic.name, epic.description ?? null, epic.color ?? null, epic.createdAt, epic.updatedAt);
    }

    // Clean up tasks and sub-tables
    const existingTaskIds = db
      .prepare("SELECT id FROM tasks WHERE project_id = ?")
      .all(project.id) as any[];
    for (const { id: tid } of existingTaskIds) {
      db.prepare("DELETE FROM task_tags WHERE task_id = ?").run(tid);
      db.prepare("DELETE FROM task_links WHERE task_id = ?").run(tid);
      db.prepare("DELETE FROM task_dependencies WHERE task_id = ?").run(tid);
      db.prepare("DELETE FROM session_tasks WHERE task_id = ?").run(tid);
    }
    db.prepare("DELETE FROM tasks WHERE project_id = ?").run(project.id);

    const insertTask = db.prepare(
      `INSERT INTO tasks (id, project_id, epic_id, column_id, name, description, priority, assignee,
                          start_date, due_date, progress, position, color, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertTag = db.prepare("INSERT OR IGNORE INTO task_tags (task_id, tag) VALUES (?, ?)");
    const insertLink = db.prepare("INSERT INTO task_links (task_id, label, url, type) VALUES (?, ?, ?, ?)");
    const insertDep = db.prepare("INSERT INTO task_dependencies (task_id, depends_on_task_id, type) VALUES (?, ?, ?)");

    for (const task of project.tasks) {
      insertTask.run(
        task.id, project.id, task.epicId || null, task.columnId, task.name,
        task.description ?? null, task.priority, task.assignee ?? null,
        task.startDate ?? null, task.dueDate ?? null, task.progress, task.position,
        task.color ?? null, JSON.stringify(task.metadata || {}), task.createdAt, task.updatedAt
      );
      for (const tag of task.tags || []) { insertTag.run(task.id, tag); }
      for (const link of task.links || []) { insertLink.run(task.id, link.label, link.url, link.type); }
      for (const dep of task.dependencies || []) { insertDep.run(task.id, dep.taskId, dep.type); }
    }

    // Replace sessions
    db.prepare("DELETE FROM sessions WHERE project_id = ?").run(project.id);
    const insertSession = db.prepare(
      `INSERT INTO sessions (id, project_id, title, notes, pomodoros_completed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertSessionTask = db.prepare("INSERT OR IGNORE INTO session_tasks (session_id, task_id) VALUES (?, ?)");
    for (const session of project.sessions || []) {
      insertSession.run(session.id, project.id, session.title, session.notes ?? "", session.pomodorosCompleted, session.createdAt, session.updatedAt);
      for (const tid of session.taskIds || []) {
        const taskExists = db.prepare("SELECT 1 FROM tasks WHERE id = ?").get(tid);
        if (taskExists) { insertSessionTask.run(session.id, tid); }
      }
    }

    // Update diagram links
    db.prepare("UPDATE diagrams SET project_id = NULL WHERE project_id = ?").run(project.id);
    if (project.diagramIds?.length) {
      const linkDiag = db.prepare("UPDATE diagrams SET project_id = ? WHERE id = ?");
      for (const did of project.diagramIds) { linkDiag.run(project.id, did); }
    }
  });

  upsert();
}

export function deleteProject(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return result.changes > 0;
}

// ─── Diagram CRUD ────────────────────────────────────────────────────

export function listDiagrams(): Diagram[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM diagrams ORDER BY updated_at DESC")
    .all() as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    mermaidCode: r.mermaid_code ?? "",
    nodes: JSON.parse(r.nodes || "[]"),
    edges: JSON.parse(r.edges || "[]"),
  }));
}

export function getDiagramById(id: string): Diagram | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM diagrams WHERE id = ?").get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mermaidCode: row.mermaid_code ?? "",
    nodes: JSON.parse(row.nodes || "[]"),
    edges: JSON.parse(row.edges || "[]"),
  };
}

export function upsertDiagram(diagram: Diagram): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO diagrams (id, name, description, mermaid_code, nodes, edges, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       mermaid_code = excluded.mermaid_code,
       nodes = excluded.nodes,
       edges = excluded.edges,
       updated_at = excluded.updated_at`
  ).run(
    diagram.id,
    diagram.name,
    diagram.description ?? "",
    diagram.mermaidCode ?? "",
    JSON.stringify(diagram.nodes || []),
    JSON.stringify(diagram.edges || []),
    diagram.createdAt,
    diagram.updatedAt
  );
}

export function deleteDiagram(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM diagrams WHERE id = ?").run(id);
  return result.changes > 0;
}
