import {
  googleConfig,
  microsoftConfig,
  redirectUri,
  type MailProvider,
} from "./config";
import { readTokens, writeTokens, type MailTokens } from "./tokens";

export function authorizeUrl(
  provider: MailProvider,
  origin: string,
  state: string
) {
  const redirect = redirectUri(origin);
  if (provider === "google") {
    const { clientId } = googleConfig();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("response_type", "code");
    url.searchParams.set(
      "scope",
      "openid email https://www.googleapis.com/auth/gmail.send"
    );
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return url.toString();
  }

  const { clientId, tenant } = microsoftConfig();
  const url = new URL(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`
  );
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set(
    "scope",
    "offline_access User.Read https://graph.microsoft.com/Mail.Send"
  );
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCode(
  provider: MailProvider,
  origin: string,
  code: string
): Promise<MailTokens> {
  if (provider === "google") {
    const { clientId, clientSecret } = googleConfig();
    const token = await postForm("https://oauth2.googleapis.com/token", {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(origin),
    });
    const accountEmail = await googleEmail(token.access_token);
    return toTokens("google", token, accountEmail);
  }

  const { clientId, clientSecret, tenant } = microsoftConfig();
  const token = await postForm(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(origin),
    }
  );
  const accountEmail = await microsoftEmail(token.access_token);
  return toTokens("microsoft", token, accountEmail);
}

export async function validAccessToken(): Promise<MailTokens | null> {
  const tokens = await readTokens();
  if (!tokens) return null;
  if (tokens.expiresAt - 60_000 > Date.now()) return tokens;
  if (!tokens.refreshToken) return tokens;

  try {
    const refreshed =
      tokens.provider === "google"
        ? await refreshGoogle(tokens.refreshToken)
        : await refreshMicrosoft(tokens.refreshToken);
    const next: MailTokens = {
      ...tokens,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || tokens.refreshToken,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
    };
    await writeTokens(next);
    return next;
  } catch {
    return null;
  }
}

async function refreshGoogle(refreshToken: string) {
  const { clientId, clientSecret } = googleConfig();
  return postForm("https://oauth2.googleapis.com/token", {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
}

async function refreshMicrosoft(refreshToken: string) {
  const { clientId, clientSecret, tenant } = microsoftConfig();
  return postForm(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }
  );
}

async function googleEmail(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const data = (await res.json()) as { email?: string };
  return data.email;
}

async function microsoftEmail(accessToken: string) {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const data = (await res.json()) as {
    mail?: string;
    userPrincipalName?: string;
  };
  return data.mail || data.userPrincipalName;
}

function toTokens(
  provider: MailProvider,
  token: TokenResponse,
  accountEmail?: string
): MailTokens {
  return {
    provider,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    accountEmail,
  };
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

async function postForm(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const data = (await res.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "OAuth token exchange failed");
  }
  return data;
}
