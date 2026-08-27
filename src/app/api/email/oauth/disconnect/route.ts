import { NextResponse } from "next/server";
import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import { clearTokens } from "@/lib/mail/tokens";
import { updateDb } from "@/lib/store";

export async function POST() {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  await clearTokens();
  const db = await updateDb((current) => {
    current.email.connected = false;
    current.email.fromEmail = "";
    return current;
  });
  return NextResponse.json(db.email);
}
