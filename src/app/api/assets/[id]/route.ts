import { NextRequest } from "next/server";
import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import { deletePublicFile } from "@/lib/files";
import { removeAsset } from "@/lib/remove";
import { updateDb } from "@/lib/store";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const { id } = await context.params;
  let url: string | undefined;
  let removed = false;
  await updateDb((current) => {
    const asset = removeAsset(current, id);
    if (asset) {
      removed = true;
      url = asset.url;
    }
    return current;
  });
  if (!removed) return Response.json({ error: "Photo not found" }, { status: 404 });
  await deletePublicFile(url);
  return Response.json({ ok: true });
}
