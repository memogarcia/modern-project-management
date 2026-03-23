import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { getArtifactById } from "@/lib/db.server";
import { jsonErrorResponse } from "@/lib/api";
import { SAFE_ENTITY_ID_RE } from "@planview/validation";

function buildContentDisposition(fileName: string): string {
  const safeFileName = fileName.replace(/["\r\n]/g, "_");
  return `attachment; filename="${safeFileName}"`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!SAFE_ENTITY_ID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid artifact id" }, { status: 400 });
    }

    const artifact = getArtifactById(id);
    if (!artifact) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }

    const bytes = await fs.readFile(artifact.absolutePath);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": artifact.mimeType,
        "Content-Length": String(artifact.sizeBytes),
        "Content-Disposition": buildContentDisposition(artifact.fileName),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
