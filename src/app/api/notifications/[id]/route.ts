import { NextRequest } from "next/server";
import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import { removeNotification } from "@/lib/remove";
import { updateDb } from "@/lib/store";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const { id } = await context.params;
  let removed = false;
  let blocked = false;
  await updateDb((current) => {
    const note = current.notifications.find((item) => item.id === id);
    if (note?.status === "sent") {
      blocked = true;
      return current;
    }
    removed = Boolean(removeNotification(current, id));
    return current;
  });
  if (blocked) {
    return Response.json(
      { error: "Sent emails stay in the outbox as a record." },
      { status: 400 }
    );
  }
  if (!removed) return Response.json({ error: "Email not found" }, { status: 404 });
  return Response.json({ ok: true });
}
