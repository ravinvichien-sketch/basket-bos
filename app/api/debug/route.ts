import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Debug endpoint — push a test message to the bound LINE group. */
export async function GET(req: NextRequest) {
  const results: string[] = [];

  // 1. Check env
  const token = process.env.LINE_MESSAGING_TOKEN;
  results.push(`LINE_MESSAGING_TOKEN: ${token ? "✅ set (" + token.slice(0, 10) + "..." : "❌ MISSING"}`);
  const secret = process.env.LINE_MESSAGING_CHANNEL_SECRET;
  results.push(`LINE_MESSAGING_CHANNEL_SECRET: ${secret ? "✅ set" : "❌ MISSING"}`);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  results.push(`NEXT_PUBLIC_APP_URL: ${appUrl ?? "❌ MISSING"}`);

  // 2. Check bot info via LINE API
  try {
    const botRes = await fetch("https://api.line.me/v2/bot/info", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (botRes.ok) {
      const info = await botRes.json();
      results.push(`LINE Bot: ✅ ${info.displayName} (${info.basicId})`);
    } else {
      const err = await botRes.text();
      results.push(`LINE Bot: ❌ ${err.slice(0, 100)}`);
    }
  } catch (e) {
    results.push(`LINE Bot: ❌ ${e}`);
  }

  const admin = createAdminClient();

  // 3. Check line_group_id in app_settings
  try {
    const { data: setting } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "line_group_id")
      .maybeSingle();
    const groupId = (setting?.value as { id?: string } | null)?.id;
    results.push(`LINE Group ID: ${groupId ? "✅ " + groupId.slice(0, 10) + "..." : "❌ No group bound — invite bot to a group first"}`);

    // 4. Attempt to push a test message
    if (token && groupId) {
      const pushRes = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: groupId,
          messages: [{ type: "text", text: "🏀 DEBUG: บอททำงานปกติ! (เวลาที่ส่ง: " + new Date().toLocaleTimeString("th-TH") + ")" }],
        }),
      });
      if (pushRes.ok) {
        results.push("Push Message: ✅ ส่งข้อความเข้ากลุ่มสำเร็จ!");
      } else {
        const err = await pushRes.text();
        results.push(`Push Message: ❌ ${err.slice(0, 200)}`);
      }
    }
  } catch (e) {
    results.push(`DB Error: ❌ ${e}`);
  }

  // 5. Check registration count
  try {
    const { count } = await admin
      .from("registrations")
      .select("*", { count: "estimated", head: true });
    results.push(`Total registrations: ${count ?? "unknown"}`);
  } catch {
    results.push("Total registrations: ❌ query failed");
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    diagnostics: results,
  });
}
