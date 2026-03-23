import { NextResponse } from "next/server";
import { saveArtifactFile } from "@/lib/db.server";
import { withApiErrorHandling } from "@/lib/api";
import { artifactOwnerSchema } from "@planview/validation";

const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const formData = await request.formData();
    const rawOwner = {
      ownerType: formData.get("ownerType"),
      diagramId: formData.get("diagramId"),
      ownerId: formData.get("ownerId"),
      label: formData.get("label"),
    };
    const owner = artifactOwnerSchema.parse({
      ownerType: typeof rawOwner.ownerType === "string" ? rawOwner.ownerType : "",
      diagramId: typeof rawOwner.diagramId === "string" && rawOwner.diagramId ? rawOwner.diagramId : undefined,
      ownerId: typeof rawOwner.ownerId === "string" ? rawOwner.ownerId : "",
      label: typeof rawOwner.label === "string" && rawOwner.label ? rawOwner.label : undefined,
    });

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file upload" }, { status: 400 });
    }
    if (!file.name.trim()) {
      return NextResponse.json({ error: "Uploaded file must have a name" }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "Uploaded file must not be empty" }, { status: 400 });
    }
    if (file.size > MAX_ARTIFACT_BYTES) {
      return NextResponse.json(
        { error: `Uploaded file exceeds the ${Math.round(MAX_ARTIFACT_BYTES / (1024 * 1024))} MB limit` },
        { status: 413 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const artifact = await saveArtifactFile({
      ownerType: owner.ownerType,
      diagramId: owner.diagramId,
      ownerId: owner.ownerId,
      label: owner.label,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes,
    });

    return NextResponse.json(artifact, { status: 201 });
  });
}
