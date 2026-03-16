import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Diagram, KanbanProject } from "./types.js";

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

export class ProjectStorage {
  private dir: string;

  constructor(baseDir: string) {
    this.dir = path.join(baseDir, "kanban");
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  private filePath(id: string): string | null {
    if (!isSafeDiagramId(id)) return null;
    return path.join(this.dir, `${id}.json`);
  }

  list(): KanbanProject[] {
    if (!fs.existsSync(this.dir)) return [];
    const files = fs.readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    const projects: KanbanProject[] = [];
    for (const fileName of files) {
      const filePath = path.join(this.dir, fileName);
      try {
        const project = readJsonFile<KanbanProject>(filePath);
        // Ensure new fields exist
        if (!project.sessions) project.sessions = [];
        if (!project.diagramIds) project.diagramIds = [];
        projects.push(project);
      } catch (error) {
        console.error(`Skipping unreadable project file: ${filePath}`, error);
      }
    }
    return projects;
  }

  get(id: string): KanbanProject | null {
    const fp = this.filePath(id);
    if (!fp) return null;
    if (!fs.existsSync(fp)) return null;
    try {
      const project = readJsonFile<KanbanProject>(fp);
      // Ensure new fields exist
      if (!project.sessions) project.sessions = [];
      if (!project.diagramIds) project.diagramIds = [];
      return project;
    } catch (error) {
      console.error(`Failed to read project file: ${fp}`, error);
      return null;
    }
  }

  save(project: KanbanProject): void {
    const fp = this.filePath(project.id);
    if (!fp) {
      throw new Error(`Invalid project id: ${project.id}`);
    }
    writeJsonFileAtomic(fp, project);
  }

  delete(id: string): boolean {
    const fp = this.filePath(id);
    if (!fp) return false;
    if (!fs.existsSync(fp)) return false;
    fs.unlinkSync(fp);
    return true;
  }
}
