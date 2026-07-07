import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const supabase = createAdminClient();
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return Response.json({ error: "no file" }, { status: 400 });

  const { error } = await supabase.storage
    .from("player_cards")
    .upload(`${profileId}.png`, file, { upsert: true, contentType: "image/png" });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage
    .from("player_cards")
    .getPublicUrl(`${profileId}.png`);

  return Response.json({ publicUrl });
}
