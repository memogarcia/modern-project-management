import { NextResponse } from "next/server";
import { saveArtifactFile } from "@/lib/db.server";
import { jsonErrorResponse } from "@/lib/api";
import { artifactOwnerSchema } from "@planview/validation";

export async function POST(request: Request) {
  try {
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
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
