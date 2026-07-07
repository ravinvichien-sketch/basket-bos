import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 120; // image generation is slow

const PROMPT =
  "Transform this photo into a dramatic professional basketball player poster portrait. " +
  "Keep the person's face and likeness clearly recognizable. " +
  "Studio-quality dramatic rim lighting, dark moody background with subtle orange glow, " +
  "high contrast, editorial sports-magazine style, slight duotone treatment. " +
  "No text, no logos, centered composition.";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่า OPENAI_API_KEY — ใช้โหมดอัพรูปตรงไปก่อนได้ครับ" },
      { status: 400 }
    );
  }

  let path: string;
  try {
    const body = await req.json();
    path = String(body.path ?? "");
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  // Players can only enhance photos in their own folder
  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  try {
    // 1. Download the uploaded source photo
    const { data: blobData, error: dlError } = await admin.storage
      .from("avatars")
      .download(path);
    if (dlError || !blobData) {
      return NextResponse.json({ error: "ไม่พบรูปที่อัพโหลด" }, { status: 404 });
    }

    // 2. Ask OpenAI to restyle it
    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", PROMPT);
    form.append("size", "1024x1024");
    form.append("quality", "medium");
    form.append("image", new File([blobData], "photo.png", { type: blobData.type || "image/png" }));

    const aiRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!aiRes.ok) {
      console.error("OpenAI error:", aiRes.status, await aiRes.text());
      return NextResponse.json(
        { error: "AI แต่งรูปไม่สำเร็จ กรุณาลองใหม่" },
        { status: 502 }
      );
    }

    const result = (await aiRes.json()) as {
      data?: { b64_json?: string }[];
    };
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: "AI ไม่ส่งรูปกลับมา" }, { status: 502 });
    }

    // 3. Store the enhanced image + set as card photo
    const outPath = `${user.id}/card-ai-${Date.now()}.png`;
    const bytes = Buffer.from(b64, "base64");
    const { error: upError } = await admin.storage
      .from("avatars")
      .upload(outPath, bytes, { contentType: "image/png" });
    if (upError) {
      return NextResponse.json({ error: "บันทึกรูปไม่สำเร็จ" }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("avatars").getPublicUrl(outPath);

    await admin
      .from("profiles")
      .update({ card_photo_url: publicUrl })
      .eq("id", user.id);

    return NextResponse.json({ url: publicUrl });
  } catch (e) {
    console.error("enhance-photo error:", e);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
