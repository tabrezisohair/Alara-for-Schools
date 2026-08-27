export type MailProvider = "google" | "microsoft";

export function appOrigin(request: Request) {
  return new URL(request.url).origin;
}

export function redirectUri(origin: string) {
  return `${origin}/api/email/oauth/callback`;
}

export function googleReady() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

export function microsoftReady() {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
  );
}

export function providerReady(provider: MailProvider) {
  return provider === "google" ? googleReady() : microsoftReady();
}

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Gmail is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local.");
  }
  return { clientId, clientSecret };
}

export function microsoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Outlook is not configured. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET to .env.local."
    );
  }
  return {
    clientId,
    clientSecret,
    tenant: process.env.MICROSOFT_TENANT_ID || "common",
  };
}
