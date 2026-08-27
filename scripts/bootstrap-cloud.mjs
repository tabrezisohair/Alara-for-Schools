import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const MEDIA = "alara-media";
const PRIV = "organization-files";
const orgId = "84a06ded-dc00-46bb-880c-9acb02a45eb4";

const { data: buckets, error: bErr } = await admin.storage.listBuckets();
if (bErr) throw bErr;
if (!buckets?.find((b) => b.id === MEDIA)) {
  const { error } = await admin.storage.createBucket(MEDIA, {
    public: true,
    fileSizeLimit: "20MB",
  });
  if (error) throw error;
  console.log("created bucket", MEDIA);
} else {
  console.log("bucket exists", MEDIA);
}

let db = JSON.parse(readFileSync("data/db.json", "utf8"));
let json = JSON.stringify(db);
const locals = [...json.matchAll(/"(\/(?:uploads|posts)\/[^"]+)"/g)].map((m) => m[1]);
const unique = [...new Set(locals)];
const map = new Map();
for (const local of unique) {
  const rel = local.replace(/^\//, "");
  const disk = join("public", rel);
  if (!existsSync(disk)) {
    console.log("missing", disk);
    continue;
  }
  const bytes = readFileSync(disk);
  const objectPath = `${orgId}/${rel}`;
  const { error } = await admin.storage.from(MEDIA).upload(objectPath, bytes, {
    upsert: true,
    contentType: rel.endsWith(".png") ? "image/png" : "image/jpeg",
  });
  if (error && !/exists|duplicate/i.test(error.message)) {
    console.log("upload fail", rel, error.message);
    continue;
  }
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${MEDIA}/${objectPath}`;
  map.set(local, url);
  console.log("media", local);
}
for (const [from, to] of map) {
  json = json.split(`"${from}"`).join(`"${to}"`);
}
db = JSON.parse(json);

const { error: wErr } = await admin.storage.from(PRIV).upload(
  `${orgId}/workspace.json`,
  Buffer.from(JSON.stringify(db)),
  { contentType: "application/json", upsert: true }
);
if (wErr) throw wErr;
console.log("wrote workspace.json jobs", db.jobs.length, "assets", db.assets.length);

for (const job of db.jobs) {
  const { error } = await admin.storage.from(PRIV).upload(
    `indexes/jobs/${job.id}.txt`,
    Buffer.from(orgId),
    { contentType: "text/plain", upsert: true }
  );
  if (error && !/exists|duplicate/i.test(error.message)) {
    console.log("index fail", job.id, error.message);
  }
}
console.log("indexed", db.jobs.length, "jobs");
