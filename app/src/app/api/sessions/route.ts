import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import type { Session } from "@/lib/sessionTypes";
import { ensureDiagramsDir } from "@/lib/diagramsDir.server";
import { listJsonFilesSafe, writeJsonFileAtomic } from "@/lib/jsonFiles.server";

const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function isSafeId(id: unknown): id is string {
  return typeof id === "string" && SAFE_ID_RE.test(id);
}

function sessionsDir(): string {
  const base = ensureDiagramsDir();
  const dir = path.join(base, "sessions");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function GET() {
  const dir = sessionsDir();
  const sessions = listJsonFilesSafe<Session>(dir);

  sessions.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return NextResponse.json(sessions);
}

export async function POST(req: Request) {
  const dir = sessionsDir();
  let session: Session;
  try {
    session = (await req.json()) as Session;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!session.id) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });
  }
  if (!isSafeId(session.id)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const filePath = path.join(dir, `${session.id}.json`);
  writeJsonFileAtomic(filePath, session);
  return NextResponse.json({ ok: true, id: session.id });
}
