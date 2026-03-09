import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Diagram, GanttChart, Session, MatrixBoard } from "./types.js";

const SAFE_DIAGRAM_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function isSafeDiagramId(id: string): boolean {
  return SAFE_DIAGRAM_ID_RE.test(id);
}

function readJsonFile<T>(filePath: string): T {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Corrupt JSON file: ${filePath}`);
    }
    throw error;
  }
}

function writeJsonFileAtomic(filePath: string, value: unknown): void {
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath);
  const tempPath = path.join(
    dir,
    `.${baseName}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
  );

  try {
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), "utf-8");
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
      // ignore cleanup failure
    }
    throw error;
  }
}

function resolveDiagramsDir(explicitDir?: string): string {
  const fromEnv = explicitDir ?? process.env.DIAGRAMS_DIR;

  const cwd = process.cwd();
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));

  const candidates: string[] = [];

  if (fromEnv) {
    candidates.push(path.isAbsolute(fromEnv) ? fromEnv : path.resolve(cwd, fromEnv));
  }

  // Common invocation locations:
  // - running from repo root (./mcp-server/diagrams-data)
  candidates.push(path.join(cwd, "mcp-server", "diagrams-data"));
  // - running from mcp-server/ (./diagrams-data)
  candidates.push(path.join(cwd, "diagrams-data"));
  // - running compiled output (dist/*) or tsx (src/*): resolve relative to this file
  candidates.push(path.join(moduleDir, "..", "diagrams-data"));

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // ignore and keep searching
    }
  }

  // If nothing exists yet, pick the best default and let the caller create it.
  if (fs.existsSync(path.join(cwd, "mcp-server"))) {
    return path.join(cwd, "mcp-server", "diagrams-data");
  }

  return path.join(moduleDir, "..", "diagrams-data");
}

export class DiagramStorage {
  private dir: string;

  constructor(dir?: string) {
    this.dir = resolveDiagramsDir(dir);
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  get baseDir(): string {
    return this.dir;
  }

  private filePath(id: string): string | null {
    if (!isSafeDiagramId(id)) return null;
    return path.join(this.dir, `${id}.json`);
  }

  list(): Diagram[] {
    const files = fs.readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    const diagrams: Diagram[] = [];
    for (const fileName of files) {
      const filePath = path.join(this.dir, fileName);
      try {
        diagrams.push(readJsonFile<Diagram>(filePath));
      } catch (error) {
        console.error(`Skipping unreadable diagram file: ${filePath}`, error);
      }
    }
    return diagrams;
  }

  get(id: string): Diagram | null {
    const fp = this.filePath(id);
    if (!fp) return null;
    if (!fs.existsSync(fp)) return null;
    try {
      return readJsonFile<Diagram>(fp);
    } catch (error) {
      console.error(`Failed to read diagram file: ${fp}`, error);
      return null;
    }
  }

  save(diagram: Diagram): void {
    const fp = this.filePath(diagram.id);
    if (!fp) {
      throw new Error(`Invalid diagram id: ${diagram.id}`);
    }
    writeJsonFileAtomic(fp, diagram);
  }

  delete(id: string): boolean {
    const fp = this.filePath(id);
    if (!fp) return false;
    if (!fs.existsSync(fp)) return false;
    fs.unlinkSync(fp);
    return true;
  }
}

export class GanttStorage {
  private dir: string;

  constructor(baseDir: string) {
    this.dir = path.join(baseDir, "gantt");
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  private filePath(id: string): string | null {
    if (!isSafeDiagramId(id)) return null;
    return path.join(this.dir, `${id}.json`);
  }

  list(): GanttChart[] {
    if (!fs.existsSync(this.dir)) return [];
    const files = fs.readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    const charts: GanttChart[] = [];
    for (const fileName of files) {
      const filePath = path.join(this.dir, fileName);
      try {
        charts.push(readJsonFile<GanttChart>(filePath));
      } catch (error) {
        console.error(`Skipping unreadable Gantt chart file: ${filePath}`, error);
      }
    }
    return charts;
  }

  get(id: string): GanttChart | null {
    const fp = this.filePath(id);
    if (!fp) return null;
    if (!fs.existsSync(fp)) return null;
    try {
      return readJsonFile<GanttChart>(fp);
    } catch (error) {
      console.error(`Failed to read Gantt chart file: ${fp}`, error);
      return null;
    }
  }

  save(chart: GanttChart): void {
    const fp = this.filePath(chart.id);
    if (!fp) {
      throw new Error(`Invalid chart id: ${chart.id}`);
    }
    writeJsonFileAtomic(fp, chart);
  }

  delete(id: string): boolean {
    const fp = this.filePath(id);
    if (!fp) return false;
    if (!fs.existsSync(fp)) return false;
    fs.unlinkSync(fp);
    return true;
  }
}

export class SessionStorage {
  private dir: string;

  constructor(baseDir: string) {
    this.dir = path.join(baseDir, "sessions");
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  private filePath(id: string): string | null {
    if (!isSafeDiagramId(id)) return null;
    return path.join(this.dir, `${id}.json`);
  }

  list(): Session[] {
    if (!fs.existsSync(this.dir)) return [];
    const files = fs.readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    const sessions: Session[] = [];
    for (const fileName of files) {
      const filePath = path.join(this.dir, fileName);
      try {
        sessions.push(readJsonFile<Session>(filePath));
      } catch (error) {
        console.error(`Skipping unreadable session file: ${filePath}`, error);
      }
    }
    return sessions;
  }

  get(id: string): Session | null {
    const fp = this.filePath(id);
    if (!fp) return null;
    if (!fs.existsSync(fp)) return null;
    try {
      return readJsonFile<Session>(fp);
    } catch (error) {
      console.error(`Failed to read session file: ${fp}`, error);
      return null;
    }
  }

  save(session: Session): void {
    const fp = this.filePath(session.id);
    if (!fp) {
      throw new Error(`Invalid session id: ${session.id}`);
    }
    writeJsonFileAtomic(fp, session);
  }

  delete(id: string): boolean {
    const fp = this.filePath(id);
    if (!fp) return false;
    if (!fs.existsSync(fp)) return false;
    fs.unlinkSync(fp);
    return true;
  }
}

export class MatrixStorage {
  private dir: string;

  constructor(baseDir: string) {
    this.dir = path.join(baseDir, "matrix");
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  private filePath(id: string): string | null {
    if (!isSafeDiagramId(id)) return null;
    return path.join(this.dir, `${id}.json`);
  }

  list(): MatrixBoard[] {
    if (!fs.existsSync(this.dir)) return [];
    const files = fs.readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    const boards: MatrixBoard[] = [];
    for (const fileName of files) {
      const filePath = path.join(this.dir, fileName);
      try {
        boards.push(readJsonFile<MatrixBoard>(filePath));
      } catch (error) {
        console.error(`Skipping unreadable matrix board file: ${filePath}`, error);
      }
    }
    return boards;
  }

  get(id: string): MatrixBoard | null {
    const fp = this.filePath(id);
    if (!fp) return null;
    if (!fs.existsSync(fp)) return null;
    try {
      return readJsonFile<MatrixBoard>(fp);
    } catch (error) {
      console.error(`Failed to read matrix board file: ${fp}`, error);
      return null;
    }
  }

  save(board: MatrixBoard): void {
    const fp = this.filePath(board.id);
    if (!fp) {
      throw new Error(`Invalid matrix board id: ${board.id}`);
    }
    writeJsonFileAtomic(fp, board);
  }

  delete(id: string): boolean {
    const fp = this.filePath(id);
    if (!fp) return false;
    if (!fs.existsSync(fp)) return false;
    fs.unlinkSync(fp);
    return true;
  }
}
