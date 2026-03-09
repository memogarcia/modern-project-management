import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import type { MatrixBoard } from "@/lib/matrixTypes";
import { ensureDiagramsDir } from "@/lib/diagramsDir.server";
import { listJsonFilesSafe, writeJsonFileAtomic } from "@/lib/jsonFiles.server";

const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function isSafeId(id: unknown): id is string {
  return typeof id === "string" && SAFE_ID_RE.test(id);
}

function matrixDir(): string {
  const base = ensureDiagramsDir();
  const dir = path.join(base, "matrix");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function GET() {
  const dir = matrixDir();
  const boards = listJsonFilesSafe<MatrixBoard>(dir);

  boards.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return NextResponse.json(boards);
}

export async function POST(req: Request) {
  const dir = matrixDir();
  let board: MatrixBoard;
  try {
    board = (await req.json()) as MatrixBoard;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!board.id) {
    return NextResponse.json({ error: "Missing board id" }, { status: 400 });
  }
  if (!isSafeId(board.id)) {
    return NextResponse.json({ error: "Invalid board id" }, { status: 400 });
  }

  const filePath = path.join(dir, `${board.id}.json`);
  writeJsonFileAtomic(filePath, board);
  return NextResponse.json({ ok: true, id: board.id });
}
