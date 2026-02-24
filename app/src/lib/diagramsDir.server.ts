import fs from "node:fs";
import path from "node:path";

function asAbsolutePath(maybeRelative: string): string {
  return path.isAbsolute(maybeRelative)
    ? maybeRelative
    : path.resolve(process.cwd(), maybeRelative);
}

/**
 * Resolve the shared diagrams-data directory.
 *
 * This must be robust to different launch CWDs:
 * - `npm --prefix app run dev` (cwd = repo root)
 * - `cd app && npm run dev` (cwd = app/)
 *
 * Preference order:
 * 1) DIAGRAMS_DIR env var (absolute, or relative to current cwd)
 * 2) <cwd>/mcp-server/diagrams-data (repo root)
 * 3) <cwd>/../mcp-server/diagrams-data (app/)
 */
export function resolveDiagramsDir(): string {
  const envDir = process.env.DIAGRAMS_DIR;

  const candidates: string[] = [];
  if (envDir) candidates.push(asAbsolutePath(envDir));

  const cwd = process.cwd();
  candidates.push(path.join(cwd, "mcp-server", "diagrams-data"));
  candidates.push(path.join(cwd, "..", "mcp-server", "diagrams-data"));
  candidates.push(path.join(cwd, "diagrams-data"));

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // ignore and keep searching
    }
  }

  // If nothing exists yet, select the most likely correct default.
  if (fs.existsSync(path.join(cwd, "mcp-server"))) {
    return path.join(cwd, "mcp-server", "diagrams-data");
  }
  if (fs.existsSync(path.join(cwd, "..", "mcp-server"))) {
    return path.join(cwd, "..", "mcp-server", "diagrams-data");
  }
  return path.join(cwd, "diagrams-data");
}

export function ensureDiagramsDir(): string {
  const dir = resolveDiagramsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
