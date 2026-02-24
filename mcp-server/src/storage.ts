import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Diagram } from "./types.js";

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

  private filePath(id: string): string {
    return path.join(this.dir, `${id}.json`);
  }

  list(): Diagram[] {
    const files = fs.readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    return files.map((f) => {
      const raw = fs.readFileSync(path.join(this.dir, f), "utf-8");
      return JSON.parse(raw) as Diagram;
    });
  }

  get(id: string): Diagram | null {
    const fp = this.filePath(id);
    if (!fs.existsSync(fp)) return null;
    const raw = fs.readFileSync(fp, "utf-8");
    return JSON.parse(raw) as Diagram;
  }

  save(diagram: Diagram): void {
    const fp = this.filePath(diagram.id);
    fs.writeFileSync(fp, JSON.stringify(diagram, null, 2), "utf-8");
  }

  delete(id: string): boolean {
    const fp = this.filePath(id);
    if (!fs.existsSync(fp)) return false;
    fs.unlinkSync(fp);
    return true;
  }
}
