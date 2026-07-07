import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 120;

const PROMPT =
  "Isolate the person in this photo as a clean cutout with the background " +
  "completely removed (transparent). Keep the person's face, body, pose and " +
  "clothing exactly as in the original photo. Slightly enhance lighting and " +
  "contrast like a professional sports poster cutout. No background, no text.";

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
      { error: "ยังไม่ได้ตั้งค่า OPENAI_API_KEY — โหมด die-cut ต้องใช้ AI ครับ" },
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
  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  try {
    const { data: blobData, error: dlError } = await admin.storage
      .from("avatars")
      .download(path);
    if (dlError || !blobData) {
      return NextResponse.json({ error: "ไม่พบรูปที่อัพโหลด" }, { status: 404 });
    }

    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", PROMPT);
    form.append("size", "1024x1024");
    form.append("quality", "medium");
    form.append("background", "transparent"); // PNG พื้นหลังโปร่งใส
    form.append(
      "image",
      new File([blobData], "photo.png", {
        type: blobData.type || "image/png",
      })
    );

    const aiRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!aiRes.ok) {
      console.error("OpenAI cutout error:", aiRes.status, await aiRes.text());
      return NextResponse.json(
        { error: "AI ตัดพื้นหลังไม่สำเร็จ กรุณาลองใหม่" },
        { status: 502 }
      );
    }

    const result = (await aiRes.json()) as { data?: { b64_json?: string }[] };
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: "AI ไม่ส่งรูปกลับมา" }, { status: 502 });
    }

    const outPath = `${user.id}/cutout-${Date.now()}.png`;
    const { error: upError } = await admin.storage
      .from("avatars")
      .upload(outPath, Buffer.from(b64, "base64"), {
        contentType: "image/png",
      });
    if (upError) {
      return NextResponse.json({ error: "บันทึกรูปไม่สำเร็จ" }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("avatars").getPublicUrl(outPath);

    await admin
      .from("profiles")
      .update({ card_photo_cutout_url: publicUrl })
      .eq("id", user.id);

    return NextResponse.json({ url: publicUrl });
  } catch (e) {
    console.error("cutout-photo error:", e);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
