import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushLineText, pushLineImage, lineConfigured } from "@/lib/line/messaging";

/**
 * Push a LINE message to a set of profiles (by profile id).
 * Fire-and-forget semantics — failures are recorded, never thrown.
 */
export async function pushToProfiles(
  profileIds: string[],
  text: string,
  type: string
): Promise<void> {
  if (!lineConfigured() || profileIds.length === 0) return;

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, line_user_id")
    .in("id", profileIds);
  if (!profiles || profiles.length === 0) return;

  const results = await Promise.allSettled(
    profiles.map((p) => pushLineText(p.line_user_id, text))
  );

  // Delivery tracking
  await admin.from("notifications").insert(
    profiles.map((p, i) => ({
      profile_id: p.id,
      type,
      channel: "line" as const,
      payload: { text },
      status:
        results[i].status === "fulfilled" && results[i].value
          ? ("sent" as const)
          : ("failed" as const),
      sent_at: new Date().toISOString(),
    }))
  );
}

/** Push an image into the LINE group chat that the bot was invited to. */
export async function pushImageToGroup(
  originalUrl: string,
  previewUrl: string
): Promise<void> {
  if (!lineConfigured()) return;
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "line_group_id")
    .maybeSingle();
  const groupId = (data?.value as { id?: string } | null)?.id;
  if (!groupId) return;
  await pushLineImage(groupId, originalUrl, previewUrl);
}

/** Push a message into the LINE group chat that a game's group is linked to. */
export async function pushToGroup(text: string, gameId?: string): Promise<void> {
  if (!lineConfigured()) return;
  const admin = createAdminClient();
  let groupId: string | undefined;

  if (gameId) {
    // Look up the game's group to find its LINE Group ID
    const { data: game } = await admin
      .from("games")
      .select("group_id")
      .eq("id", gameId)
      .single();
    if (game?.group_id) {
      const { data: grp } = await admin
        .from("groups")
        .select("line_group_id")
        .eq("id", game.group_id)
        .single();
      groupId = grp?.line_group_id ?? undefined;
    }
  }

  // Fallback: global app_settings (legacy)
  if (!groupId) {
    const { data } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "line_group_id")
      .maybeSingle();
    groupId = (data?.value as { id?: string } | null)?.id;
  }

  if (!groupId) return;
  await pushLineText(groupId, text);
}

/** Push to every onboarded member of the group. */
export async function pushToAllMembers(
  text: string,
  type: string
): Promise<void> {
  if (!lineConfigured()) return;
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("onboarded", true);
  await pushToProfiles((profiles ?? []).map((p) => p.id), text, type);
}
