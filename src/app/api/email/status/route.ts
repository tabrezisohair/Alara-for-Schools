import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import { googleReady, microsoftReady } from "@/lib/mail/config";
import { readTokens } from "@/lib/mail/tokens";
import { readDb } from "@/lib/store";
import { syncEmailConnection } from "@/lib/mail/dispatch";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const tokens = await readTokens();
  const db = await syncEmailConnection(await readDb());
  return Response.json({
    googleReady: googleReady(),
    microsoftReady: microsoftReady(),
    connected: Boolean(tokens),
    provider: tokens?.provider ?? db.email.provider,
    fromEmail: tokens?.accountEmail || db.email.fromEmail || "",
  });
}
