import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * ทางเลือกชั่วคราว — Push ข้อความเข้ากลุ่ม LINE แทนรอ webhook
 * เปิด browser → พิมพ์ command → LINE กลุ่มได้รับข้อความตอบกลับ
 */
export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ ok: false, error: "ต้องระบุข้อความ" });
    }

    const admin = createAdminClient();
    const token = process.env.LINE_MESSAGING_TOKEN;

    // Get bound group ID
    const { data: setting } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "line_group_id")
      .maybeSingle();

    const groupId = (setting?.value as { id?: string } | null)?.id;
    if (!groupId) {
      return NextResponse.json({
        ok: false,
        error: "ยังไม่มี group ผูก — เชิญบอทเข้ากลุ่มก่อน",
      });
    }

    const lineUserId = null; // can't identify user from push
    const text2 = text.trim();
    const isHelp = /^(ช่วยเหลือ|help|สวัสดี)\b/i.test(text2);
    const isGames = /^(เกม|games)\b/i.test(text2);
    const isRoster = /^(คิว|ดูคิว|roster)\b/i.test(text2) || /^roster/i.test(text2);
    const isStatus = /^(สถานะ|status)\b/i.test(text2);
    const isLeave = /^(ถอน|ถอนตัว|leave)\b/i.test(text2);
    const isJoin = /^(ลงชื่อ|join)\b/i.test(text2);

    let replyText = "";

    if (isHelp) {
      replyText = [
        "🏀 **คำสั่งใน LINE**",
        "",
        "`ลงชื่อ` หรือ `join` — ลงชื่อเกมถัดไป",
        "`ลงชื่อ ชื่อเกม` — ลงชื่อเกมที่ระบุ",
        "`คิว` หรือ `roster` — ดูรายชื่อเกมล่าสุด",
        "`คิว ชื่อเกม` — ดูรายชื่อเกมที่ระบุ",
        "`ถอน` หรือ `leave` — ถอนตัวจากเกมล่าสุด",
        "`สถานะ` หรือ `status` — ดูเกมที่คุณลงชื่อไว้",
        "`เกม` หรือ `games` — ดูเกมที่เปิดรับสมัคร",
        "`ช่วยเหลือ` หรือ `help` — แสดงคำสั่งนี้",
      ].join("\n");
    } else if (isGames) {
      const { data: games } = await admin
        .from("games")
        .select("title, starts_at, location, max_players")
        .eq("status", "open")
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(10);

      if (!games || games.length === 0) {
        replyText = "🏀 ขณะนี้ยังไม่มีเกมเปิดรับสมัคร";
      } else {
        replyText = "🏀 **เกมที่เปิดรับสมัคร:**\n\n" +
          games.map((g, i) =>
            `${i + 1}. ${g.title}\n   📅 ${new Date(g.starts_at).toLocaleDateString("th-TH")}\n   👥 ${g.max_players} คน`
          ).join("\n\n");
      }
    } else if (isRoster) {
      const keyword = text2.replace(/^(คิว|ดูคิว|roster)\s*/i, "").trim() || "latest";
      const { data: games } = await admin
        .from("games")
        .select("id, title")
        .eq("status", "open")
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(5);

      const game = keyword === "latest" ? games?.[0] : games?.find(
        (g) => g.id === keyword || g.title.toLowerCase().includes(keyword.toLowerCase())
      );

      if (!game) {
        replyText = "❌ ไม่พบเกม";
      } else {
        const { data: regs } = await admin
          .from("registrations")
          .select("status, profiles!profile_id(nickname)")
          .eq("game_id", game.id)
          .in("status", ["confirmed", "waitlisted", "tentative"])
          .order("registered_at", { ascending: true });

        const nick = (r: { profiles: unknown }) =>
          (r.profiles as { nickname?: string } | null)?.nickname ?? "ผู้เล่น";
        const confirmed = (regs ?? []).filter((r) => r.status === "confirmed").map(nick);
        const tentative = (regs ?? []).filter((r) => r.status === "tentative").map(nick);
        const waitlist = (regs ?? []).filter((r) => r.status === "waitlisted").map(nick);

        replyText = `🏀 ${game.title}\n👥 ตัวจริง (${confirmed.length})\n`;
        replyText += confirmed.map((n, i) => `${i + 1}. ${n}`).join("\n") || "  -";
        if (tentative.length > 0) {
          replyText += `\n\n🤷 ไม่แน่นอน (${tentative.length})\n`;
          replyText += tentative.map((n, i) => `${i + 1}. ${n}`).join("\n");
        }
        if (waitlist.length > 0) {
          replyText += `\n\n⏳ สำรอง (${waitlist.length})\n`;
          replyText += waitlist.map((n, i) => `${i + 1}. ${n}`).join("\n");
        }
      }
    } else {
      replyText = "❌ ไม่รู้จักคำสั่ง — พิมพ์ `ช่วยเหลือ` เพื่อดูคำสั่ง";
    }

    // Push to group
    const pushRes = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LINE_MESSAGING_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: groupId,
        messages: [{ type: "text", text: replyText }],
      }),
    });

    return NextResponse.json({
      ok: pushRes.ok,
      reply: replyText.slice(0, 200),
      pushStatus: pushRes.status,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}

/** Simple input form */
export async function GET() {
  return new Response(
    `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>🏀 Basket Bos - LINE Command</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Kanit', sans-serif; background: #0f172a; color: #e2e8f0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100dvh; margin: 0; padding: 20px; }
    .card { background: #1e293b; border-radius: 16px; padding: 24px; width: 100%; max-width: 400px; }
    h1 { font-size: 1.25rem; margin: 0 0 16px 0; text-align: center; }
    input { width: 100%; padding: 12px 16px; border-radius: 12px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; font-size: 1rem; margin-bottom: 12px; }
    button { width: 100%; padding: 12px; border-radius: 12px; border: none; background: #F97316; color: #fff; font-size: 1rem; font-weight: 600; cursor: pointer; }
    button:disabled { opacity: 0.5; }
    pre { background: #0f172a; border-radius: 8px; padding: 12px; margin-top: 12px; font-size: 0.8rem; white-space: pre-wrap; overflow-x: auto; }
    .help { font-size: 0.75rem; color: #94a3b8; margin-top: 16px; text-align: center; }
    .help code { background: #334155; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🏀 สั่ง LINE กลุ่ม</h1>
    <input type="text" id="cmd" placeholder="เช่น ช่วยเหลือ, เกม, คิว" autofocus>
    <button id="sendBtn" onclick="send()">ส่งคำสั่ง</button>
    <div id="result"></div>
    <div class="help">
      คำสั่ง: <code>ช่วยเหลือ</code> <code>เกม</code> <code>คิว</code>
    </div>
  </div>
  <script>
    async function send() {
      const btn = document.getElementById('sendBtn');
      const res = document.getElementById('result');
      const cmd = document.getElementById('cmd').value.trim();
      if (!cmd) return;
      btn.disabled = true;
      btn.textContent = 'กำลังส่ง...';
      res.innerHTML = '';
      try {
        const r = await fetch('/api/push-cmd', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cmd })
        });
        const data = await r.json();
        res.innerHTML = '<pre>' + (data.error || data.reply || JSON.stringify(data)) + '</pre>';
      } catch(e) {
        res.innerHTML = '<pre style="color:#ef4444">' + e + '</pre>';
      }
      btn.disabled = false;
      btn.textContent = 'ส่งคำสั่ง';
    }
    document.getElementById('cmd').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  </script>
</body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
