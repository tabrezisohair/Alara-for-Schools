import { NextRequest } from "next/server";
import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import { removeCalendarEvent } from "@/lib/remove";
import { updateDb } from "@/lib/store";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const { id } = await context.params;
  let removed = false;
  await updateDb((current) => {
    removed = Boolean(removeCalendarEvent(current, id));
    return current;
  });
  if (!removed) return Response.json({ error: "Date not found" }, { status: 404 });
  return Response.json({ ok: true });
}
