import { readTokens } from "./tokens";
import { sendNotification } from "./send";
import { readDb, updateDb } from "../store";
import type { Database, EmailNotification } from "../types";

export async function syncEmailConnection(db: Database): Promise<Database> {
  const tokens = await readTokens();
  const connected = Boolean(tokens);
  if (
    db.email.connected === connected &&
    db.email.provider === (tokens?.provider ?? db.email.provider) &&
    db.email.fromEmail === (tokens?.accountEmail || db.email.fromEmail)
  ) {
    return db;
  }
  db.email.connected = connected;
  if (tokens) {
    db.email.provider = tokens.provider;
    db.email.fromEmail = tokens.accountEmail || db.email.fromEmail;
  } else {
    db.email.fromEmail = "";
  }
  return db;
}

export async function dispatchMail(id: string): Promise<EmailNotification | null> {
  const tokens = await readTokens();
  if (!tokens) return null;

  const db = await readDb();
  const mail = db.notifications.find((item) => item.id === id);
  if (!mail || mail.status === "sent") return mail ?? null;

  try {
    await sendNotification(mail);
    return updateMail(id, { status: "sent", error: undefined, sentAt: new Date().toISOString() });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Send failed";
    return updateMail(id, { status: "failed", error, sentAt: new Date().toISOString() });
  }
}

export async function dispatchQueued(ids?: string[]) {
  const db = await readDb();
  const queued = db.notifications.filter(
    (item) => item.status === "queued" && (!ids || ids.includes(item.id))
  );
  const results: EmailNotification[] = [];
  for (const item of queued) {
    const next = await dispatchMail(item.id);
    if (next) results.push(next);
  }
  return results;
}

async function updateMail(
  id: string,
  patch: Partial<EmailNotification>
): Promise<EmailNotification | null> {
  let updated: EmailNotification | null = null;
  await updateDb((current) => {
    current.notifications = current.notifications.map((item) => {
      if (item.id !== id) return item;
      updated = { ...item, ...patch };
      return updated;
    });
    return current;
  });
  return updated;
}
