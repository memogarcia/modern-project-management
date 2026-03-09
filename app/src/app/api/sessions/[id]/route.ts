import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import type { Session } from "@/lib/sessionTypes";
import { ensureDiagramsDir } from "@/lib/diagramsDir.server";
import { CorruptJsonFileError, readJsonFile, writeJsonFileAtomic } from "@/lib/jsonFiles.server";

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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSafeId(id)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const fp = path.join(sessionsDir(), `${id}.json`);
  if (!fs.existsSync(fp)) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  try {
    const data = readJsonFile<Session>(fp);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof CorruptJsonFileError) {
      return NextResponse.json({ error: "Corrupt session file" }, { status: 500 });
    }
    throw error;
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSafeId(id)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const fp = path.join(sessionsDir(), `${id}.json`);
  if (!fs.existsSync(fp)) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  let body: Session;
  try {
    body = (await req.json()) as Session;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.id !== id) {
    return NextResponse.json({ error: "ID mismatch" }, { status: 400 });
  }

  writeJsonFileAtomic(fp, { ...body, updatedAt: new Date().toISOString() });
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSafeId(id)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const fp = path.join(sessionsDir(), `${id}.json`);
  if (!fs.existsSync(fp)) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  fs.unlinkSync(fp);
  return NextResponse.json({ ok: true });
}
