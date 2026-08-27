import { NextRequest } from "next/server";
import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import { deletePublicFile } from "@/lib/files";
import { removeEventFolder } from "@/lib/remove";
import { updateDb } from "@/lib/store";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const { id } = await context.params;
  let urls: string[] = [];
  let removed = false;
  let blocked = false;
  await updateDb((current) => {
    const folder = current.folders.find((item) => item.id === id);
    if (folder && folder.kind !== "event") {
      blocked = true;
      return current;
    }
    const result = removeEventFolder(current, id);
    if (result.folder) {
      removed = true;
      urls = result.assets.map((asset) => asset.url);
    }
    return current;
  });
  if (blocked) {
    return Response.json(
      { error: "Event type folders stay in the library." },
      { status: 400 }
    );
  }
  if (!removed) return Response.json({ error: "Folder not found" }, { status: 404 });
  await Promise.all(urls.map((url) => deletePublicFile(url)));
  return Response.json({ ok: true });
}
