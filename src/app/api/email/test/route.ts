import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import { testEmail } from "@/lib/notify";
import { dispatchMail } from "@/lib/mail/dispatch";
import { updateDb } from "@/lib/store";

export async function POST() {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const db = await updateDb((current) => {
    current.notifications.unshift(testEmail(current));
    return current;
  });
  const queued = db.notifications[0];
  const sent = (await dispatchMail(queued.id)) ?? queued;
  return Response.json(sent);
}
