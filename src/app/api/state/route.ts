import { requireSession } from "@/lib/auth/membership";
import { syncEmailConnection } from "@/lib/mail/dispatch";
import { readTokens } from "@/lib/mail/tokens";
import { readDb, updateDb, writeDb } from "@/lib/store";
import type { Database } from "@/lib/types";

export const dynamic = "force-dynamic";

async function denyIfSignedOut() {
  const user = await requireSession();
  if (user instanceof Response) return user;
  return null;
}

export async function GET() {
  const denied = await denyIfSignedOut();
  if (denied) return denied;

  try {
    const db = await readDb();
    const before = JSON.stringify(db.email);
    await syncEmailConnection(db);
    if (JSON.stringify(db.email) !== before) await writeDb(db);
    return Response.json(db);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load workspace";
    const status = /No school workspace/i.test(message) ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  const denied = await denyIfSignedOut();
  if (denied) return denied;

  const patch = (await request.json()) as Partial<Database>;
  const tokens = await readTokens();
  const db = await updateDb((current) => {
    const next = { ...current, ...patch };
    if (patch.email) {
      next.email = {
        ...current.email,
        ...patch.email,
        connected: Boolean(tokens),
        fromEmail: tokens?.accountEmail || current.email.fromEmail || "",
        provider: tokens?.provider ?? patch.email.provider ?? current.email.provider,
      };
    }
    return next;
  });
  return Response.json(db);
}
