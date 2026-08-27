import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import { saveUploadFile } from "@/lib/files";
import { newId } from "@/lib/brain";
import { updateDb } from "@/lib/store";
import type { PhotoFlag } from "@/lib/types";

export async function POST(request: Request) {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const form = await request.formData();
  const file = form.get("file");
  const folderId = String(form.get("folderId") || "");
  const flag = (String(form.get("flag") || "internal") as PhotoFlag);
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file" }, { status: 400 });
  }
  const saved = await saveUploadFile(file, "uploads");
  const db = await updateDb((current) => {
    const id = newId("asset");
    current.assets.push({
      id,
      folderId: folderId || current.folders[0]?.id || "fld-sports",
      url: saved.url,
      name: saved.name,
      flag,
      enhanced: false,
      keepOriginal: true,
      createdAt: new Date().toISOString(),
    });
    return current;
  });
  return Response.json(db.assets.at(-1));
}
