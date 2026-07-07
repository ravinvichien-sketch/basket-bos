import "server-only";
import { env } from "@/lib/env";

const AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export function redirectUri() {
  return `${env("NEXT_PUBLIC_APP_URL")}/auth/callback`;
}

export function buildAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env("LINE_CHANNEL_ID"),
    redirect_uri: redirectUri(),
    state,
    scope: "profile openid",
    // Works inside the LINE in-app browser; auto-consents on repeat logins.
    bot_prompt: "aggressive",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<{
  id_token: string;
  access_token: string;
}> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      client_id: env("LINE_CHANNEL_ID"),
      client_secret: env("LINE_CHANNEL_SECRET"),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`LINE token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export interface LineIdentity {
  sub: string; // LINE user ID
  name?: string;
  picture?: string;
}

/** Verifies the id_token with LINE's endpoint and returns the identity claims. */
export async function verifyIdToken(idToken: string): Promise<LineIdentity> {
  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: env("LINE_CHANNEL_ID"),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`LINE id_token verification failed: ${res.status}`);
  }
  const claims = (await res.json()) as LineIdentity;
  if (!claims.sub) throw new Error("LINE id_token missing sub claim");
  return claims;
}
