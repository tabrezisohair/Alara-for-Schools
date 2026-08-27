import { promises as fs } from "fs";
import path from "path";
import { newId } from "./brain";
import {
  MEDIA_BUCKET,
  cloudStorageEnabled,
  ensureMediaBucket,
  mediaPathFromUrl,
  publicMediaUrl,
} from "./cloudMedia";
import { resolveOrganizationId } from "./orgScope";
import { createAdminSupabase } from "./supabase/admin";

function extFromMime(mime: string) {
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

export async function saveDataUrl(dataUrl: string, folder = "uploads") {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data");
  const ext = extFromMime(match[1]);
  const name = `${newId("img")}.${ext}`;
  const bytes = Buffer.from(match[2], "base64");
  return saveBytes(bytes, folder, name, match[1]);
}

export async function deletePublicFile(url?: string) {
  if (!url || url.includes("..")) return;
  if (cloudStorageEnabled()) {
    const objectPath = mediaPathFromUrl(url);
    if (objectPath && !objectPath.includes("..")) {
      const admin = createAdminSupabase();
      await admin.storage.from(MEDIA_BUCKET).remove([objectPath]);
      return;
    }
  }
  if (!url.startsWith("/uploads/") && !url.startsWith("/posts/")) return;
  const filePath = path.join(process.cwd(), "public", url.replace(/^\//, ""));
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

export async function saveUploadFile(file: File, folder = "uploads") {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const name = `${newId("up")}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const url = await saveBytes(buf, folder, name, file.type || "application/octet-stream");
  return { url, name: file.name };
}

async function saveBytes(
  bytes: Buffer,
  folder: string,
  name: string,
  contentType: string
) {
  if (cloudStorageEnabled()) {
    const orgId = await resolveOrganizationId();
    if (!orgId) throw new Error("Sign in required to save files");
    await ensureMediaBucket();
    const objectPath = `${orgId}/${folder}/${name}`;
    const admin = createAdminSupabase();
    const { error } = await admin.storage.from(MEDIA_BUCKET).upload(objectPath, bytes, {
      contentType,
      upsert: true,
    });
    if (error) throw new Error(error.message);
    return publicMediaUrl(objectPath);
  }

  const dir = path.join(process.cwd(), "public", folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), bytes);
  return `/${folder}/${name}`;
}
