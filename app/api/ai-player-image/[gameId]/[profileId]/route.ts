import { createAdminClient } from "@/lib/supabase/admin";
import { saveAiImageUrl } from "@/features/stats/actions";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string; profileId: string }> }
) {
  const { gameId, profileId } = await params;
  const admin = createAdminClient();

  // Check if already generated
  const { data: existing } = await admin
    .from("player_card_generations")
    .select("ai_image_url")
    .eq("game_id", gameId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existing?.ai_image_url) {
    return Response.json({ url: existing.ai_image_url });
  }

  // Get player data + stats
  const [
    { data: profile },
    { data: stats },
    { data: game },
  ] = await Promise.all([
    admin.from("profiles").select("id, nickname, avatar_url, height_cm, weight_kg").eq("id", profileId).single(),
    admin.from("player_game_stats").select("points, assists, reb_off, reb_def, steals, blocks, fgm, fga, tpm, tpa, ftm, fta").eq("game_id", gameId).eq("profile_id", profileId),
    admin.from("games").select("title").eq("id", gameId).single(),
  ]);

  if (!profile || !game) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const statRows = (stats ?? []) as {
    points: number; assists: number; reb_off: number; reb_def: number;
    steals: number; blocks: number; fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number;
  }[];

  const totals = {
    points: 0, assists: 0, reb: 0, steals: 0, blocks: 0,
    fgm: 0, fga: 0, tpm: 0, tpa: 0,
  };
  for (const s of statRows) {
    totals.points += s.points; totals.assists += s.assists;
    totals.reb += s.reb_off + s.reb_def; totals.steals += s.steals;
    totals.blocks += s.blocks; totals.fgm += s.fgm; totals.fga += s.fga;
    totals.tpm += s.tpm; totals.tpa += s.tpa;
  }

  const isStar = totals.points >= 20 || totals.assists >= 10 || totals.reb >= 10;
  const isGood = totals.points >= 10 || (totals.assists >= 5 && totals.reb >= 5);
  const fgPct = totals.fga > 0 ? Math.round((totals.fgm / totals.fga) * 100) : 0;

  let actionPhrase: string;
  let mood: string;
  if (isStar) {
    actionPhrase = "dunking powerfully in an NBA game with intense action, confetti falling, crowd cheering";
    mood = "epic, cinematic lighting, dramatic";
  } else if (isGood) {
    actionPhrase = "shooting a three-pointer in an NBA game, focused expression, dynamic pose";
    mood = "dynamic, energetic, vibrant";
  } else {
    actionPhrase = "playing basketball casually in a local court, dribbling, relaxed pose";
    mood = "calm, natural lighting, modest";
  }

  const genderHint = profile.nickname.endsWith("า") ? "female" : "male";
  const avatarDesc = profile.avatar_url
    ? "athletic basketball player"
    : `athletic ${genderHint} basketball player`;

  const prompt = `NBA-style basketball player card illustration, ${avatarDesc} resembling a ${genderHint} player with ${profile.nickname}'s features (${profile.height_cm ?? 180}cm tall), ${actionPhrase}. The player wears a basketball jersey, ${mood}, digital art style, vibrant colors, full body action shot, white background with subtle gradient.`;

  try {
    const model = process.env.AI_IMAGE_MODEL || "huggingface";
    if (model === "openai") {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) return Response.json({ error: "OPENAI_API_KEY not configured" }, { status: 501 });
      const oaRes = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: "dall-e-3", prompt, n: 1, size: "1024x1024", quality: "standard" }),
      });
      if (!oaRes.ok) { const e = await oaRes.text(); console.error("OpenAI error:", e); return Response.json({ error: "AI failed" }, { status: 500 }); }
      const d = await oaRes.json();
      const imgUrl = d.data?.[0]?.url;
      if (!imgUrl) return Response.json({ error: "No image" }, { status: 500 });
      const dl = await fetch(imgUrl);
      const imageBlob = await dl.blob();
      return await uploadAndSave(imageBlob, admin, gameId, profileId);
    }

    if (model === "cloudflare") {
      const cfToken = process.env.CLOUDFLARE_API_TOKEN;
      const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      if (!cfToken || !cfAccountId) {
        return Response.json({ error: "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID required" }, { status: 501 });
      }
      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfToken}` },
          body: JSON.stringify({ prompt, num_steps: 20, guidance: 7.5 }),
        }
      );
      if (!cfRes.ok) { const e = await cfRes.text(); console.error("CF AI error:", e); return Response.json({ error: "AI failed" }, { status: 500 }); }
      const imageBlob = await cfRes.blob();
      return await uploadAndSave(imageBlob, admin, gameId, profileId);
    }

    // Default: HuggingFace (free)
    const hfToken = process.env.HUGGINGFACE_TOKEN;
    if (!hfToken) {
      return Response.json({ error: "HUGGINGFACE_TOKEN not configured. Set it in Vercel env vars" }, { status: 501 });
    }
    const response = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-3.5-large",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${hfToken}` },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { negative_prompt: "nsfw, low quality, blurry, distorted face, ugly, deformed", num_inference_steps: 20, guidance_scale: 7.5, width: 1024, height: 1024 },
        }),
      }
    );
    if (!response.ok) { const e = await response.text(); console.error("HuggingFace error:", e); return Response.json({ error: "AI failed" }, { status: 500 }); }
    const imageBlob = await response.blob();
    return await uploadAndSave(imageBlob, admin, gameId, profileId);
  } catch (err) {
    console.error("AI image error:", err);
    return Response.json({ error: "AI image generation failed" }, { status: 500 });
  }
}

async function uploadAndSave(
  imageBlob: Blob,
  admin: ReturnType<typeof createAdminClient>,
  gameId: string,
  profileId: string
): Promise<Response> {
  const filePath = `${gameId}/${profileId}/ai-player.png`;
  const { error: uploadError } = await admin.storage
    .from("player_cards")
    .upload(filePath, imageBlob, { contentType: "image/png", upsert: true });
  if (uploadError) {
    console.error("Upload error:", uploadError);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
  const { data: publicUrlData } = admin.storage.from("player_cards").getPublicUrl(filePath);
  await saveAiImageUrl(gameId, profileId, publicUrlData.publicUrl);
  return Response.json({ url: publicUrlData.publicUrl });
}
