import { createAdminSupabase } from "@/lib/supabase/admin";

export const MEDIA_BUCKET = "alara-media";
export const PRIVATE_BUCKET = "organization-files";

let bucketReady: Promise<void> | null = null;

export function cloudStorageEnabled() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function ensureMediaBucket() {
  if (!cloudStorageEnabled()) return;
  if (!bucketReady) {
    bucketReady = (async () => {
      const admin = createAdminSupabase();
      const { data: buckets } = await admin.storage.listBuckets();
      const existing = buckets?.find((item) => item.id === MEDIA_BUCKET);
      if (!existing) {
        const { error } = await admin.storage.createBucket(MEDIA_BUCKET, {
          public: true,
          fileSizeLimit: "20MB",
        });
        if (error && !/already exists|duplicate/i.test(error.message)) {
          throw error;
        }
      } else if (!existing.public) {
        await admin.storage.updateBucket(MEDIA_BUCKET, { public: true });
      }
    })().catch((err) => {
      bucketReady = null;
      throw err;
    });
  }
  await bucketReady;
}

export function publicMediaUrl(objectPath: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${objectPath}`;
}

export function mediaPathFromUrl(url?: string) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at >= 0) return decodeURIComponent(url.slice(at + marker.length).split("?")[0]);
  const local = url.match(/^\/(uploads|posts)\/([^/?#]+)$/);
  if (local) return local[0].slice(1);
  return null;
}
