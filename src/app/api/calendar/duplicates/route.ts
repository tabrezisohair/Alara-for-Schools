import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import { removeDuplicateCalendarEvents } from "@/lib/remove";
import { updateDb } from "@/lib/store";

export async function DELETE() {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  let removed = 0;
  await updateDb((current) => {
    removed = removeDuplicateCalendarEvents(current).length;
    return current;
  });
  return Response.json({ ok: true, removed });
}
