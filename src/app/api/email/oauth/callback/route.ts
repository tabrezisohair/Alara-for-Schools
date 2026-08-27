import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/mail/oauth";
import { writeTokens } from "@/lib/mail/tokens";
import { updateDb } from "@/lib/store";
import type { MailProvider } from "@/lib/mail/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.cookies.get("alara_oauth_state")?.value;

  if (error) {
    return finish(request, "error", error);
  }
  if (!code || !state || !cookie || state !== cookie) {
    return finish(request, "error", "state");
  }

  let parsed: { provider: MailProvider; origin: string };
  try {
    parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return finish(request, "error", "state");
  }

  try {
    const tokens = await exchangeCode(parsed.provider, parsed.origin, code);
    await writeTokens(tokens);
    await updateDb((current) => {
      current.email.provider = tokens.provider;
      current.email.connected = true;
      current.email.fromEmail = tokens.accountEmail || "";
      return current;
    });
    return finish(request, "connected");
  } catch (err) {
    const reason = err instanceof Error ? err.message : "oauth";
    return finish(request, "error", reason.slice(0, 120));
  }
}

function finish(request: NextRequest, status: "connected" | "error", reason?: string) {
  const dest = new URL("/settings", request.url);
  dest.searchParams.set("email", status);
  if (reason) dest.searchParams.set("reason", reason);
  const res = NextResponse.redirect(dest);
  res.cookies.delete("alara_oauth_state");
  return res;
}
