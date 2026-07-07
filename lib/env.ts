/** Server-side env access with fail-fast validation. Never import in client components. */
const required = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LINE_CHANNEL_ID",
  "LINE_CHANNEL_SECRET",
  "AUTH_PASSWORD_SECRET",
  "PROMPTPAY_ID",
] as const;

type RequiredKey = (typeof required)[number];

export function env(key: RequiredKey): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}
