import { promises as fs } from "fs";
import path from "path";
import type { MailProvider } from "./config";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { PRIVATE_BUCKET, cloudStorageEnabled } from "@/lib/cloudMedia";
import { resolveOrganizationId } from "@/lib/orgScope";

export type MailTokens = {
  provider: MailProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  accountEmail?: string;
};

const FILE = path.join(process.cwd(), "data", "email-tokens.json");

function objectPath(orgId: string) {
  return `${orgId}/mail-tokens.json`;
}

export async function readTokens(): Promise<MailTokens | null> {
  if (cloudStorageEnabled()) {
    const orgId = await resolveOrganizationId();
    if (!orgId) return null;
    const admin = createAdminSupabase();
    const { data, error } = await admin.storage.from(PRIVATE_BUCKET).download(objectPath(orgId));
    if (error || !data) return null;
    return JSON.parse(await data.text()) as MailTokens;
  }
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as MailTokens;
  } catch {
    return null;
  }
}

export async function writeTokens(tokens: MailTokens) {
  if (cloudStorageEnabled()) {
    const orgId = await resolveOrganizationId();
    if (!orgId) throw new Error("No school workspace is assigned to this account.");
    const admin = createAdminSupabase();
    const { error } = await admin.storage.from(PRIVATE_BUCKET).upload(
      objectPath(orgId),
      Buffer.from(JSON.stringify(tokens), "utf8"),
      { contentType: "application/json", upsert: true }
    );
    if (error) throw new Error(error.message);
    return;
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(tokens, null, 2), "utf8");
}

export async function clearTokens() {
  if (cloudStorageEnabled()) {
    const orgId = await resolveOrganizationId();
    if (!orgId) return;
    const admin = createAdminSupabase();
    await admin.storage.from(PRIVATE_BUCKET).remove([objectPath(orgId)]);
    return;
  }
  try {
    await fs.unlink(FILE);
  } catch {
    // already gone
  }
}
