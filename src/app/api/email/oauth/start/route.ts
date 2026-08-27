import { NextRequest, NextResponse } from "next/server";
import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import { appOrigin, providerReady, type MailProvider } from "@/lib/mail/config";
import { authorizeUrl } from "@/lib/mail/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const provider = request.nextUrl.searchParams.get("provider") as MailProvider | null;
  if (provider !== "google" && provider !== "microsoft") {
    return NextResponse.redirect(new URL("/settings?email=error&reason=provider", request.url));
  }
  if (!providerReady(provider)) {
    return NextResponse.redirect(
      new URL(`/settings?email=setup&provider=${provider}`, request.url)
    );
  }

  const nonce = crypto.randomUUID();
  const origin = appOrigin(request);
  const state = Buffer.from(
    JSON.stringify({ provider, nonce, origin })
  ).toString("base64url");
  const res = NextResponse.redirect(authorizeUrl(provider, origin, state));
  res.cookies.set("alara_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
