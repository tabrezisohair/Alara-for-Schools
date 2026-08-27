import { promises as fs } from "fs";
import path from "path";
import { cedarSeed } from "./seed";
import type { Database } from "./types";
import { createAdminSupabase } from "./supabase/admin";
import {
  MEDIA_BUCKET,
  PRIVATE_BUCKET,
  cloudStorageEnabled,
  ensureMediaBucket,
  publicMediaUrl,
} from "./cloudMedia";
import { resolveOrganizationId } from "./orgScope";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

let queue: Promise<unknown> = Promise.resolve();

function workspaceObject(orgId: string) {
  return `${orgId}/workspace.json`;
}

function jobIndexObject(jobId: string) {
  return `indexes/jobs/${jobId}.txt`;
}

async function ensureLocal() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(path.join(process.cwd(), "public", "uploads"), {
    recursive: true,
  });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(cedarSeed(), null, 2), "utf8");
  }
}

async function readJsonObject<T>(bucket: string, objectPath: string): Promise<T | null> {
  const admin = createAdminSupabase();
  const { data, error } = await admin.storage.from(bucket).download(objectPath);
  if (error || !data) return null;
  const text = await data.text();
  return JSON.parse(text) as T;
}

async function writeJsonObject(bucket: string, objectPath: string, value: unknown) {
  const admin = createAdminSupabase();
  const body = Buffer.from(JSON.stringify(value), "utf8");
  const { error } = await admin.storage.from(bucket).upload(objectPath, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw new Error(error.message);
}

async function writeTextObject(bucket: string, objectPath: string, value: string) {
  const admin = createAdminSupabase();
  const { error } = await admin.storage.from(bucket).upload(
    objectPath,
    Buffer.from(value, "utf8"),
    { contentType: "text/plain", upsert: true }
  );
  if (error) throw new Error(error.message);
}

async function syncJobIndex(orgId: string, previous: Database | null, next: Database) {
  const admin = createAdminSupabase();
  const before = new Set((previous?.jobs ?? []).map((job) => job.id));
  const after = new Set(next.jobs.map((job) => job.id));
  const removed = [...before].filter((id) => !after.has(id));
  if (removed.length) {
    await admin.storage
      .from(PRIVATE_BUCKET)
      .remove(removed.map((id) => jobIndexObject(id)));
  }
  for (const id of after) {
    if (!before.has(id)) {
      await writeTextObject(PRIVATE_BUCKET, jobIndexObject(id), orgId);
    }
  }
}

async function migrateLocalMedia(orgId: string, db: Database): Promise<Database> {
  await ensureMediaBucket();
  const admin = createAdminSupabase();
  const json = JSON.stringify(db);
  const locals = [...json.matchAll(/"(\/(?:uploads|posts)\/[^"]+)"/g)].map((m) => m[1]);
  const unique = [...new Set(locals)];
  const map = new Map<string, string>();
  for (const local of unique) {
    const rel = local.replace(/^\//, "");
    const disk = path.join(process.cwd(), "public", rel);
    try {
      const bytes = await fs.readFile(disk);
      const objectPath = `${orgId}/${rel}`;
      const { error } = await admin.storage.from(MEDIA_BUCKET).upload(objectPath, bytes, {
        upsert: true,
        contentType: rel.endsWith(".png") ? "image/png" : "image/jpeg",
      });
      if (!error || /exists|duplicate/i.test(error.message)) {
        map.set(local, publicMediaUrl(objectPath));
      }
    } catch {
      // file not on this machine
    }
  }
  if (!map.size) return db;
  let next = json;
  for (const [from, to] of map) {
    next = next.split(`"${from}"`).join(`"${to}"`);
  }
  return JSON.parse(next) as Database;
}

export async function organizationIdForJob(jobId: string) {
  if (!cloudStorageEnabled()) return null;
  const admin = createAdminSupabase();
  const { data, error } = await admin.storage
    .from(PRIVATE_BUCKET)
    .download(jobIndexObject(jobId));
  if (error || !data) return null;
  const orgId = (await data.text()).trim();
  return orgId || null;
}

async function readCloud(orgId: string): Promise<Database> {
  const existing = await readJsonObject<Database>(PRIVATE_BUCKET, workspaceObject(orgId));
  if (existing) return existing;

  let seeded = cedarSeed();
  try {
    await ensureLocal();
    const raw = await fs.readFile(DATA_FILE, "utf8");
    seeded = JSON.parse(raw) as Database;
    seeded = await migrateLocalMedia(orgId, seeded);
  } catch {
    seeded = cedarSeed();
  }
  await writeJsonObject(PRIVATE_BUCKET, workspaceObject(orgId), seeded);
  await syncJobIndex(orgId, null, seeded);
  return seeded;
}

async function writeCloud(orgId: string, db: Database, previous: Database | null) {
  await writeJsonObject(PRIVATE_BUCKET, workspaceObject(orgId), db);
  await syncJobIndex(orgId, previous, db);
}

export async function readDb(): Promise<Database> {
  if (cloudStorageEnabled()) {
    const orgId = await resolveOrganizationId();
    if (!orgId) throw new Error("No school workspace is assigned to this account.");
    return readCloud(orgId);
  }
  await ensureLocal();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw) as Database;
}

export async function writeDb(db: Database): Promise<Database> {
  if (cloudStorageEnabled()) {
    const orgId = await resolveOrganizationId();
    if (!orgId) throw new Error("No school workspace is assigned to this account.");
    const previous = await readJsonObject<Database>(PRIVATE_BUCKET, workspaceObject(orgId));
    await writeCloud(orgId, db, previous);
    return db;
  }
  await ensureLocal();
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
  return db;
}

export async function updateDb(
  mutator: (db: Database) => Database | Promise<Database>
): Promise<Database> {
  const run = queue.then(async () => {
    const db = await readDb();
    const next = await mutator(db);
    return writeDb(next);
  });
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
