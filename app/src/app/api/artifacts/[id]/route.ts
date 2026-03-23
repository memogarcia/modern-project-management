import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { getArtifactById } from "@/lib/db.server";
import { jsonNotFound, jsonRoute, parseRouteParams } from "@/lib/api";

function buildContentDisposition(fileName: string): string {
  const safeFileName = fileName.replace(/["\r\n]/g, "_");
  return `attachment; filename="${safeFileName}"`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return jsonRoute(async () => {
    const { id } = await parseRouteParams(params, [{ key: "id", label: "artifact id" }]);
    const artifact = getArtifactById(id);
    if (!artifact) {
      return jsonNotFound("Artifact not found");
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
  });
}
