import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushImageToGroup } from "@/features/notifications/line";

/**
 * Generate session summary image and push to LINE group.
 * Fire-and-forget — never throws.
 */
export async function generateAndSendSummary(gameId: string) {
  try {
    const admin = createAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) return;

    // 1. Fetch the summary image from internal API route
    const res = await fetch(`${appUrl}/api/session-summary/${gameId}`, {
      // Use a reasonable timeout — ImageResponse may take a few seconds
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return;
    const pngBuffer = await res.arrayBuffer();

    // 2. Upload to storage
    const path = `summaries/${gameId}.png`;
    const { error: uploadError } = await admin.storage
      .from("summaries")
      .upload(path, new Uint8Array(pngBuffer), {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadError) return;

    const { data: { publicUrl } } = admin.storage
      .from("summaries")
      .getPublicUrl(path);

    // 3. Push to LINE group
    await pushImageToGroup(publicUrl, publicUrl);
  } catch {
    // best-effort — never block game completion
  }
}
