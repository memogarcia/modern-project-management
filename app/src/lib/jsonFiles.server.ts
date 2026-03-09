import fs from "node:fs";
import path from "node:path";

export class CorruptJsonFileError extends Error {
  constructor(
    public readonly filePath: string,
    cause?: unknown
  ) {
    super(`Corrupt JSON file: ${filePath}`);
    this.name = "CorruptJsonFileError";
    this.cause = cause;
  }
}

export function readJsonFile<T>(filePath: string): T {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new CorruptJsonFileError(filePath, error);
    }
    throw error;
  }
}

export function listJsonFilesSafe<T>(dir: string): T[] {
  const files = fs.readdirSync(dir).filter((fileName) => fileName.endsWith(".json"));
  const items: T[] = [];

  for (const fileName of files) {
    const filePath = path.join(dir, fileName);
    try {
      items.push(readJsonFile<T>(filePath));
    } catch (error) {
      console.error(`Skipping unreadable JSON file: ${filePath}`, error);
    }
  }

  return items;
}

export function writeJsonFileAtomic(filePath: string, value: unknown): void {
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
