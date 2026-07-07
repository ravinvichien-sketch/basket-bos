import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { LineIdentity } from "@/lib/line/oauth";

/**
 * LINE is the only identity provider. We bridge it into Supabase Auth by
 * provisioning an email+password user whose password is deterministically
 * derived from the LINE user ID + a server secret. The password never leaves
 * the server and is never shown to anyone.
 */
export function credentialsFor(lineUserId: string) {
  const password = createHmac("sha256", env("AUTH_PASSWORD_SECRET"))
    .update(`line:${lineUserId}`)
    .digest("hex");
  const email = `line_${lineUserId.toLowerCase()}@auth.basketbos.local`;
  return { email, password };
}

export interface ProvisionResult {
  email: string;
  password: string;
  onboarded: boolean;
}

/** Finds or creates the Supabase user + profile for a verified LINE identity. */
export async function provisionLineUser(
  identity: LineIdentity
): Promise<ProvisionResult> {
  const admin = createAdminClient();
  const { email, password } = credentialsFor(identity.sub);

  const { data: existing, error: findError } = await admin
    .from("profiles")
    .select("id, onboarded, avatar_url")
    .eq("line_user_id", identity.sub)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    // Keep LINE avatar fresh if the user never uploaded a custom one.
    if (identity.picture && !existing.avatar_url?.includes("supabase")) {
      await admin
        .from("profiles")
        .update({ avatar_url: identity.picture })
        .eq("id", existing.id);
    }
    return { email, password, onboarded: existing.onboarded };
  }

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { line_user_id: identity.sub, name: identity.name },
    });
  if (createError) throw createError;

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    line_user_id: identity.sub,
    nickname: identity.name ?? "",
    avatar_url: identity.picture ?? null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw profileError;
  }

  return { email, password, onboarded: false };
}
