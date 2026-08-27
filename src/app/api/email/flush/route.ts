import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import { dispatchQueued } from "@/lib/mail/dispatch";
import { readTokens } from "@/lib/mail/tokens";

export async function POST() {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  if (!(await readTokens())) {
    return Response.json(
      { error: "Connect Gmail or Outlook first." },
      { status: 400 }
    );
  }
  const sent = await dispatchQueued();
  return Response.json({ sent });
}
