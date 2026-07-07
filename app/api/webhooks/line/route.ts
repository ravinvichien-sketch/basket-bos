import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { replyLineText } from "@/lib/line/messaging";
import { createAdminClient } from "@/lib/supabase/admin";
import { gameListFlex } from "@/features/notifications/flex";

export const runtime = "nodejs";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Resolve "latest" or a title keyword to a game ID. Returns null if not found. */
async function resolveGame(
  admin: AdminClient,
  keyword?: string
): Promise<string | null> {
  const now = new Date().toISOString();
  const query = admin
    .from("games")
    .select("id, title")
    .eq("status", "open")
    .gte("ends_at", now)
    .order("starts_at", { ascending: true })
    .limit(5);

  const { data: games } = await query;
  if (!games || games.length === 0) return null;

  if (!keyword || keyword === "latest") return games[0].id;

  const lower = keyword.toLowerCase();
  const match = games.find(
    (g) => g.id === keyword || g.title.toLowerCase().includes(lower)
  );
  return match?.id ?? null;
}

async function handleJoin(
  admin: AdminClient,
  replyToken: string,
  lineUserId: string,
  gameId: string
) {
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (!profile) {
    await replyLineText(
      replyToken,
      "🔄 กรุณาเข้าสู่ระบบผ่าน Web App ก่อนใช้บริการนี้\n" +
        (process.env.NEXT_PUBLIC_APP_URL ?? "")
    );
    return;
  }

  const { data: game } = await admin
    .from("games")
    .select("id, status, reg_opens_at, reg_deadline, max_players, max_waitlist")
    .eq("id", gameId)
    .maybeSingle();

  if (!game || game.status !== "open") {
    await replyLineText(replyToken, "⛔ ยังไม่เปิดรับสมัคร หรือปิดรับไปแล้ว");
    return;
  }

  const now = new Date();
  const opensAt = new Date(game.reg_opens_at);
  const deadline = new Date(game.reg_deadline);
  if (now < opensAt || now > deadline) {
    await replyLineText(replyToken, "⛔ ยังไม่เปิดรับสมัคร หรือปิดรับไปแล้ว");
    return;
  }

  const { data: existing } = await admin
    .from("registrations")
    .select("id, status")
    .eq("game_id", gameId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (existing && existing.status !== "cancelled") {
    await replyLineText(replyToken, "✅ คุณลงชื่อไปแล้ว");
    return;
  }

  const { count: confirmedCount } = await admin
    .from("registrations")
    .select("*", { count: "exact", head: true })
    .eq("game_id", gameId)
    .eq("status", "confirmed");

  const isFull = (confirmedCount ?? 0) >= game.max_players;
  let newStatus: string;

  if (!isFull) {
    newStatus = "confirmed";
  } else {
    const { count: waitlistCount } = await admin
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId)
      .eq("status", "waitlisted");
    if ((waitlistCount ?? 0) >= (game.max_waitlist ?? 0)) {
      await replyLineText(replyToken, "❌ Session เต็มแล้ว");
      return;
    }
    newStatus = "waitlisted";
  }

  if (existing) {
    await admin.from("registrations").update({
      status: newStatus,
      registered_at: new Date().toISOString(),
      cancelled_at: null,
      promoted_at: null,
    }).eq("id", existing.id);
  } else {
    await admin.from("registrations").insert({
      game_id: gameId,
      profile_id: profile.id,
      status: newStatus,
    });
  }

  await replyWithRoster(admin, replyToken, gameId);
}

/** Show a text menu of available commands. */
async function replyHelp(replyToken: string) {
  const text = [
    "🏀 **คำสั่งใน LINE**",
    "",
    "`ลงชื่อ` หรือ `join` — ลงชื่อ Session ถัดไป",
    "`ลงชื่อ ชื่อเกม` — ลงชื่อ Session ที่ระบุ",
    "`คิว` หรือ `roster` — ดูรายชื่อ Session ล่าสุด",
    "`คิว ชื่อเกม` — ดูรายชื่อ Session ที่ระบุ",
    "`ถอน` หรือ `leave` — ถอนตัวจาก Session ล่าสุด",
    "`สถานะ` หรือ `status` — ดู Session ที่คุณลงชื่อไว้",
    "`เกม` หรือ `games` — ดู Session ที่เปิดรับสมัคร",
    "`ช่วยเหลือ` หรือ `help` — แสดงคำสั่งนี้",
    "",
    "เปิดแอป: " + (process.env.NEXT_PUBLIC_APP_URL ?? ""),
  ].join("\n");
  await replyLineText(replyToken, text);
}

/** Refactored per-event helper — keeps the event loop clean. */
async function handleEvent(
  event: {
    type: string;
    replyToken?: string;
    source?: { type?: string; groupId?: string; userId?: string };
    postback?: { data?: string };
    message?: { text?: string };
  },
  admin: AdminClient
) {
  const replyToken = event.replyToken;
  const lineUserId = event.source?.userId;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (!replyToken) return;

  // --- follow (add friend) ---
  if (event.type === "follow") {
    await replyLineText(
      replyToken,
      `สวัสดีครับ 🏀 ยินดีต้อนรับสู่ Basket Bos!\nระบบจะแจ้งเตือนคุณเมื่อ: เปิดรับสมัคร Session ใหม่, ได้เลื่อนจากคิวสำรอง, ประกาศทีม และเตือนค่าสนาม\n\nเปิดแอป: ${appUrl}`
    );
    return;
  }

  // --- join bot (invited to group) → bind group ---
  if (event.type === "join" && event.source?.groupId) {
    await admin.from("app_settings").upsert({
      key: "line_group_id",
      value: { id: event.source.groupId },
      updated_at: new Date().toISOString(),
    });
    await replyLineText(
      replyToken,
      `ผูกกลุ่มนี้กับ Basket Bos แล้ว 🏀\nต่อไปนี้เวลามีคนลงชื่อ/ถอนตัว ระบบจะส่งรายชื่ออัพเดตเข้ากลุ่มนี้อัตโนมัติ\n\nเปิดแอป: ${appUrl}`
    );
    return;
  }

  // --- postback (Flex / Rich Menu button press) ---
  if (event.type === "postback" && event.postback?.data) {
    const data = event.postback.data;
    if (!lineUserId) return;

    const [action, param] = data.split(":") as [string, string | undefined];

    if (action === "join" && param) {
      const gameId = await resolveGame(admin, param);
      if (!gameId) {
        await replyLineText(replyToken, "❌ ไม่พบ Session ที่เปิดรับ");
        return;
      }
      await handleJoin(admin, replyToken, lineUserId, gameId);
      return;
    }

    if (action === "roster") {
      const gameId = await resolveGame(admin, param ?? "latest");
      if (!gameId) {
        await replyLineText(replyToken, "❌ ไม่มี Session ที่เปิดรับอยู่");
        return;
      }
      await replyWithRoster(admin, replyToken, gameId);
      return;
    }

    if (action === "games") {
      await replyGamesList(admin, replyToken);
      return;
    }
  }

  // --- text message (typed commands) ---
  if (event.type === "message" && event.message?.text) {
    const text = event.message.text.trim();

    // Simple keyword matching — Thai words without \b, English words with \b
    const isJoin = /^ลงชื่อ/i.test(text) || /^join\b/i.test(text);
    const isRoster = /^(คิว|ดูคิว)/i.test(text) || /^roster\b/i.test(text);
    const isLeave = /^(ถอน|ถอนตัว)/i.test(text) || /^leave\b/i.test(text);
    const isStatus = /^สถานะ/i.test(text) || /^status\b/i.test(text);
    const isGames = /^เกม/i.test(text) || /^games\b/i.test(text);
    const isHelp = /^(ช่วยเหลือ|สวัสดี)/i.test(text) || /^help\b/i.test(text);

    if (!isHelp && !isGames && !isJoin && !isRoster && !isLeave && !isStatus) {
      await replyHelp(replyToken);
      return;
    }

    if (isHelp) {
      await replyHelp(replyToken);
      return;
    }

    if (isGames) {
      await replyGamesList(admin, replyToken);
      return;
    }

    if (isJoin) {
      if (!lineUserId) return;
      const keyword = text.replace(/^(ลงชื่อ|join)\s*/i, "").trim() || "latest";
      const gameId = await resolveGame(admin, keyword);
      if (!gameId) {
        await replyLineText(replyToken, "❌ ไม่พบ Session ที่เปิดรับ — พิมพ์ `เกม` เพื่อดูรายชื่อ Session");
        return;
      }
      await handleJoin(admin, replyToken, lineUserId, gameId);
      return;
    }

    if (isRoster) {
      const keyword = text.replace(/^(คิว|ดูคิว|roster)\s*/i, "").trim() || "latest";
      const gameId = await resolveGame(admin, keyword);
      if (!gameId) {
        await replyLineText(replyToken, "❌ ไม่มี Session ที่เปิดรับอยู่");
        return;
      }
      await replyWithRoster(admin, replyToken, gameId);
      return;
    }

    if (isLeave) {
      if (!lineUserId) return;
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .eq("line_user_id", lineUserId)
        .maybeSingle();
      if (!profile) {
        await replyLineText(replyToken, "🔄 กรุณาเข้าสู่ระบบผ่าน Web App ก่อน\n" + appUrl);
        return;
      }
      const gameId = await resolveGame(admin, "latest");
      if (!gameId) {
        await replyLineText(replyToken, "❌ ไม่มี Session ที่เปิดรับอยู่");
        return;
      }
      const { error } = await admin.rpc("cancel_registration", {
        p_game_id: gameId,
        p_profile_id: profile.id,
      });
      if (error) {
        await replyLineText(replyToken, "❌ ถอนตัวไม่สำเร็จ — คุณอาจยังไม่ได้ลงชื่อ");
        return;
      }
      await replyWithRoster(admin, replyToken, gameId);
      return;
    }

    if (isStatus) {
      if (!lineUserId) return;
      const { data: profile } = await admin
        .from("profiles")
        .select("id, nickname")
        .eq("line_user_id", lineUserId)
        .maybeSingle();
      if (!profile) {
        await replyLineText(replyToken, "🔄 กรุณาเข้าสู่ระบบผ่าน Web App ก่อน\n" + appUrl);
        return;
      }
      const { data: regs } = await admin
        .from("registrations")
        .select("game_id, status, games!inner(title, starts_at, status)")
        .eq("profile_id", profile.id)
        .in("games.status", ["open", "completed"])
        .order("games(starts_at)", { ascending: false })
        .limit(5);

      if (!regs || regs.length === 0) {
        await replyLineText(replyToken, "📭 คุณยังไม่ได้ลงชื่อใน Session ไหนเลย");
        return;
      }
      const lines = regs.map((r) => {
        const g = (r.games as unknown) as { title: string; starts_at: string; status: string };
        const statusMap: Record<string, string> = {
          confirmed: "✅ ตัวจริง",
          waitlisted: "⏳ สำรอง",
          tentative: "🤷 ไม่แน่นอน",
        };
        return `• ${g.title} — ${statusMap[r.status] ?? r.status}`;
      });
      await replyLineText(replyToken, "📋 สถานะของคุณ:\n" + lines.join("\n"));
      return;
    }
  }
}

/** LINE Messaging API webhook — handles follow, join, postback, and text commands. */
export async function POST(req: NextRequest) {
  const body = await req.text();

  const secret = process.env.LINE_MESSAGING_CHANNEL_SECRET;
  if (secret) {
    const signature = req.headers.get("x-line-signature") ?? "";
    const expected = createHmac("sha256", secret).update(body).digest("base64");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "bad signature" }, { status: 401 });
    }
  }

  let payload: { events?: unknown[] };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const admin = createAdminClient();

  for (const raw of payload.events ?? []) {
    const event = raw as {
      type: string;
      replyToken?: string;
      source?: { type?: string; groupId?: string; userId?: string };
      postback?: { data?: string };
      message?: { text?: string };
    };
    await handleEvent(event, admin);
  }

  return NextResponse.json({ ok: true });
}

/** Send available games as a Flex Carousel. */
async function replyGamesList(admin: AdminClient, replyToken: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const { data: games } = await admin
    .from("games")
    .select("id, title, starts_at, location, max_players")
    .eq("status", "open")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(10);

  if (!games || games.length === 0) {
    await replyLineText(
      replyToken,
      "🏀 ขณะนี้ยังไม่มี Session เปิดรับสมัคร\n\nติดตามในแอป: " + appUrl
    );
    return;
  }

  const { data: counts } = await admin
    .from("v_game_counts")
    .select("game_id, confirmed_count")
    .in("game_id", games.map((g) => g.id));

  const countMap = new Map(
    (counts ?? []).map((c) => [c.game_id, Number(c.confirmed_count)])
  );

  const briefs = games.map((g) => ({
    id: g.id,
    title: g.title,
    startsAt: new Date(g.starts_at).toLocaleDateString("th-TH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    location: g.location,
    confirmed: countMap.get(g.id) ?? 0,
    maxPlayers: g.max_players,
  }));

  const flex = gameListFlex(briefs);
  const token = process.env.LINE_MESSAGING_TOKEN;
  if (token) {
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        replyToken,
        messages: [flex],
      }),
    });
  }
}

async function replyWithRoster(
  admin: ReturnType<typeof createAdminClient>,
  replyToken: string,
  gameId: string
) {
  const [{ data: game }, { data: regs }] = await Promise.all([
    admin
      .from("games")
      .select("title, starts_at, location, notes, max_players, groups!group_id(name)")
      .eq("id", gameId)
      .single(),
    admin
      .from("registrations")
      .select("status, profiles!profile_id(nickname)")
      .eq("game_id", gameId)
      .in("status", ["confirmed", "waitlisted", "tentative"])
      .order("registered_at", { ascending: true }),
  ]);

  if (!game) {
    await replyLineText(replyToken, "❌ ไม่พบ Session นี้");
    return;
  }

  const nick = (r: { profiles: unknown }) =>
    (r.profiles as { nickname?: string } | null)?.nickname ?? "ผู้เล่น";
  const confirmed = (regs ?? [])
    .filter((r) => r.status === "confirmed")
    .map(nick);
  const waitlist = (regs ?? [])
    .filter((r) => r.status === "waitlisted")
    .map(nick);
  const tentative = (regs ?? [])
    .filter((r) => r.status === "tentative")
    .map(nick);

  const group = game.groups as { name?: string } | null;
  const dateStr = new Date(game.starts_at).toLocaleDateString("th-TH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let text = `🏀 ${game.title}\n`;
  if (group?.name) text += `🎯 ${group.name}\n`;
  text += `📅 ${dateStr}\n`;
  text += `📍 ${game.location}\n`;
  if (game.notes) text += `📝 ${game.notes}\n`;
  text += `👥 ตัวจริง (${confirmed.length}/${game.max_players})\n`;
  text += confirmed.map((n, i) => `${i + 1}. ${n}`).join("\n") || "  -";
  if (tentative.length > 0) {
    text += `\n\n🤷 ไม่แน่นอน (${tentative.length})\n`;
    text += tentative.map((n, i) => `${i + 1}. ${n}`).join("\n");
  }
  if (waitlist.length > 0) {
    text += `\n\n⏳ สำรอง (${waitlist.length})\n`;
    text += waitlist.map((n, i) => `${i + 1}. ${n}`).join("\n");
  }

  await replyLineText(replyToken, text);
}
