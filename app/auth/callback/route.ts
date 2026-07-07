import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };
import { exchangeCode, verifyIdToken } from "@/lib/line/oauth";
import { provisionLineUser } from "@/features/auth/service";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = request.cookies.get("line_oauth_state")?.value;

  const fail = (reason: string) =>
    NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(reason)}`, request.url)
    );

  if (!code || !state || !storedState || state !== storedState) {
    return fail("invalid_state");
  }

  try {
    const tokens = await exchangeCode(code);
    const identity = await verifyIdToken(tokens.id_token);
    const { email, password, onboarded } = await provisionLineUser(identity);

    const destination = onboarded ? "/dashboard" : "/onboarding";
    const response = NextResponse.redirect(new URL(destination, request.url));
    response.cookies.delete("line_oauth_state");

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return fail("session_failed");

    return response;
  } catch (e) {
    console.error("LINE callback error:", e);
    return fail("line_login_failed");
  }
}
