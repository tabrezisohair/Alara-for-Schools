import type { NextRequest } from "next/server";

/**
 * Where the school reaches Alara. Behind a proxy the request URL is the
 * internal address, so the forwarded headers win, and a configured public
 * URL wins over both because that is the one an emailed link must use.
 */
export function appOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!host) return request.nextUrl.origin;
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}
