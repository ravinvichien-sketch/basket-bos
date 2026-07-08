import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { replyLineText } from "@/lib/line/messaging";
import { createAdminClient } from "@/lib/supabase/admin";
import { gameListFlex } from "@/features/notifications/flex";

export const runtime = "nodejs";

type AdminClient = ReturnType<typeof createAdminClient>;

// ── Group-scoped helpers ──

interface AppGroup {
  id: string;
  name: string;
}

/** Look up the app group linked to this LINE Group ID */
async function findGroupByLineId(
  admin: AdminClient,
  lineGroupId: string
): Promise<AppGroup | null> {
  const { data } = await admin
    .from("groups")
    .select("id, name")
    .eq("line_group_id", lineGroupId)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

interface OpenGameBrief {
  id: string;
  title: string;
  starts_at: string;
}

/** Get open games belonging to a specific app group */
async function getOpenGamesInGroup(
  admin: AdminClient,
  groupId: string
): Promise<OpenGameBrief[]> {
  const now = new Date().toISOString();
  const { data } = await admin
    .from("games")
    .select("id, title, starts_at")
    .eq("group_id", groupId)
    .eq("status", "open")
    .gte("ends_at", now)
    .order("starts_at", { ascending: true })
    .limit(5);
  return data ?? [];
}

/** Send a Flex carousel so the user can pick which session */
async function replySessionPicker(
  replyToken: string,
  groupName: string,
  games: OpenGameBrief[]
) {
  const flex = {
    type: "flex",
    altText: `🏀 เลือก Session (${groupName})`,
    contents: {
      type: "carousel",
      contents: games.map((g) => {
        const dateStr = new Date(g.starts_at).toLocaleDateString("th-TH", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        return {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            paddingAll: "16px",
            contents: [
              {
                type: "text",
                text: g.title,
                weight: "bold",
                size: "lg",
                wrap: true,
              },
              {
                type: "text",
                text: `📅 ${dateStr}`,
                size: "sm",
                color: "#94a3b8",
              },
            ],
          },
          footer: {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#F97316",
                action: {
                  type: "postback",
                  label: "✅ ลงชื่อ",
                  data: `join:${g.id}`,
                },
              },
              {
                type: "button",
                style: "secondary",
                action: {
                  type: "postback",
                  label: "📋 ดูคิว",
                  data: `roster:${g.id}`,
                },
              },
            ],
          },
        };
      }),
    },
  };
  const token = process.env.LINE_MESSAGING_TOKEN;
  if (token) {
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ replyToken, messages: [flex] }),
    });
  }
}

/** Pick a game from a list — auto if only 1, or match keyword */
function pickGame(
  games: OpenGameBrief[],
  keyword?: string
): OpenGameBrief | null {
  if (games.length === 0) return null;
  if (games.length === 1) return games[0];
  if (!keyword || keyword === "latest") return games[0];
  const lower = keyword.toLowerCase();
  return (
    games.find(
      (g) => g.id === keyword || g.title.toLowerCase().includes(lower)
    ) ?? null
  );
}

/** Resolve game by keyword, scoped to a LINE group if possible */
async function resolveGameScoped(
  admin: AdminClient,
  replyToken: string,
  lineGroupId: string | undefined,
  keyword: string | undefined,
  groupName: string
): Promise<string | null> {
  const group = lineGroupId ? await findGroupByLineId(admin, lineGroupId) : null;

  if (!group) {
    // No group binding — use legacy global lookup
    const now = new Date().toISOString();
    const { data: games } = await admin
      .from("games")
      .select("id, title")
      .eq("status", "open")
      .gte("ends_at", now)
      .order("starts_at", { ascending: true })
      .limit(5);
    if (!games || games.length === 0) return null;
    if (!keyword || keyword === "latest") return games[0].id;
    const lower = keyword.toLowerCase();
    const match = games.find(
      (g) => g.id === keyword || g.title.toLowerCase().includes(lower)
    );
    return match?.id ?? null;
  }

  const openGames = await getOpenGamesInGroup(admin, group.id);
  if (openGames.length === 0) return null;

  const picked = pickGame(openGames, keyword);
  if (picked) return picked.id;

  // Multiple open sessions, no keyword match → show picker
  await replySessionPicker(replyToken, group.name, openGames);
  return "PICKER_SENT";
}

// ── Existing handlers (unchanged logic) ──

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
    await admin
      .from("registrations")
      .update({
        status: newStatus,
        registered_at: new Date().toISOString(),
        cancelled_at: null,
        promoted_at: null,
      })
      .eq("id", existing.id);
  } else {
    await admin.from("registrations").insert({
      game_id: gameId,
      profile_id: profile.id,
      status: newStatus,
    });
  }

  await replyWithRoster(admin, replyToken, gameId);
}

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
  const lineGroupId = event.source?.groupId;
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

  // --- join bot (invited to group) → reply with LINE Group ID ---
  if (event.type === "join" && lineGroupId) {
    await replyLineText(
      replyToken,
      [
        `ผูกกลุ่มนี้กับ Basket Bos แล้ว 🏀`,
        ``,
        `LINE Group ID ของคุณคือ:`,
        `${lineGroupId}`,
        ``,
        `คัดลอก ID ด้านบนไปวางในแอป > หน้าก๊วน > แก้ไข LINE Group`,
        `แล้วระบบจะแจ้งเตือนนัดลงสนามมาที่กลุ่มนี้โดยอัตโนมัติ`,
      ].join("\n")
    );
    return;
  }

  // --- postback (Flex / Rich Menu button press) ---
  if (event.type === "postback" && event.postback?.data) {
    const data = event.postback.data;
    if (!lineUserId) return;

    const [action, param] = data.split(":") as [string, string | undefined];

    if (action === "join" && param) {
      await handleJoin(admin, replyToken, lineUserId, param);
      return;
    }

    if (action === "roster" && param) {
      const gameId = param;
      await replyWithRoster(admin, replyToken, gameId);
      return;
    }

    if (action === "games") {
      // If in a group, scope to group's games
      const group = lineGroupId ? await findGroupByLineId(admin, lineGroupId) : null;
      await replyGamesList(admin, replyToken, group?.id);
      return;
    }
  }

  // --- text message (typed commands) ---
  if (event.type === "message" && event.message?.text) {
    const text = event.message.text.trim();

    const isJoin = /^ลงชื่อ/i.test(text) || /^join\b/i.test(text);
    const isRoster = /^(คิว|ดูคิว)/i.test(text) || /^roster\b/i.test(text);
    const isLeave = /^(ถอน|ถอนตัว)/i.test(text) || /^leave\b/i.test(text);
    const isStatus = /^สถานะ/i.test(text) || /^status\b/i.test(text);
    const isGames = /^เกม/i.test(text) || /^games\b/i.test(text);
    const isGroupId = /^(groupid|myid|ไอดีกลุ่ม)$/i.test(text);
    const isHelp = /^(ช่วยเหลือ|สวัสดี)/i.test(text) || /^help\b/i.test(text);

    if (
      !isHelp &&
      !isGames &&
      !isJoin &&
      !isRoster &&
      !isLeave &&
      !isStatus &&
      !isGroupId
    ) {
      await replyHelp(replyToken);
      return;
    }

    if (isHelp) {
      await replyHelp(replyToken);
      return;
    }

    if (isGroupId) {
      if (!lineGroupId) {
        await replyLineText(
          replyToken,
          "คำสั่งนี้ใช้ได้เฉพาะในแชทกลุ่มเท่านั้น"
        );
        return;
      }
      await replyLineText(
        replyToken,
        `LINE Group ID ของคุณคือ:\n${lineGroupId}\n\nคัดลอกไปวางในแอปที่ หน้าก๊วน > แก้ไข LINE Group`
      );
      return;
    }

    // ── Group-scoped commands ──

    // Find the app group linked to this LINE group (if any)
    const group = lineGroupId ? await findGroupByLineId(admin, lineGroupId) : null;

    if (isGames) {
      await replyGamesList(admin, replyToken, group?.id);
      return;
    }

    if (isJoin) {
      if (!lineUserId) return;
      const keyword =
        text.replace(/^(ลงชื่อ|join)\s*/i, "").trim() || undefined;

      if (!group && !lineGroupId) {
        // DM — use legacy global lookup
        const gameId = await resolveGameScoped(
          admin,
          replyToken,
          undefined,
          keyword,
          ""
        );
        if (!gameId) {
          await replyLineText(
            replyToken,
            "❌ ไม่พบ Session ที่เปิดรับ — พิมพ์ `เกม` เพื่อดูรายชื่อ Session"
          );
        }
        return;
      }

      if (!group) {
        await replyLineText(
          replyToken,
          "❌ ยังไม่ได้ผูก LINE Group นี้กับก๊วนในแอป\n" +
            "พิมพ์ `groupid` เพื่อคัดลอก ID ไปตั้งค่าในแอป"
        );
        return;
      }

      const openGames = await getOpenGamesInGroup(admin, group.id);
      if (openGames.length === 0) {
        await replyLineText(
          replyToken,
          "❌ ก๊วนนี้ยังไม่มี Session ที่เปิดรับอยู่"
        );
        return;
      }

      const picked = pickGame(openGames, keyword);
      if (picked) {
        await handleJoin(admin, replyToken, lineUserId, picked.id);
      } else {
        // Multiple sessions, no clear match → show picker
        await replySessionPicker(replyToken, group.name, openGames);
      }
      return;
    }

    if (isRoster) {
      const keyword =
        text.replace(/^(คิว|ดูคิว|roster)\s*/i, "").trim() || undefined;

      if (!group && !lineGroupId) {
        // DM — legacy
        const gameId = await resolveGameScoped(
          admin,
          replyToken,
          undefined,
          keyword,
          ""
        );
        if (gameId && gameId !== "PICKER_SENT") {
          await replyWithRoster(admin, replyToken, gameId);
        } else if (!gameId) {
          await replyLineText(
            replyToken,
            "❌ ไม่มี Session ที่เปิดรับอยู่"
          );
        }
        return;
      }

      if (!group) {
        await replyLineText(
          replyToken,
          "❌ ยังไม่ได้ผูก LINE Group นี้กับก๊วนในแอป"
        );
        return;
      }

      const openGames = await getOpenGamesInGroup(admin, group.id);
      if (openGames.length === 0) {
        await replyLineText(
          replyToken,
          "❌ ก๊วนนี้ยังไม่มี Session ที่เปิดรับอยู่"
        );
        return;
      }

      const picked = pickGame(openGames, keyword);
      if (picked) {
        await replyWithRoster(admin, replyToken, picked.id);
      } else {
        await replySessionPicker(replyToken, group.name, openGames);
      }
      return;
    }

    if (isLeave) {
      if (!lineUserId) return;

      if (!group && !lineGroupId) {
        // DM — try the latest game globally
        const gameId = await resolveGameScoped(
          admin,
          replyToken,
          undefined,
          "latest",
          ""
        );
        if (!gameId || gameId === "PICKER_SENT") {
          await replyLineText(
            replyToken,
            "❌ ไม่มี Session ที่เปิดรับอยู่"
          );
          return;
        }
        const { data: profile } = await admin
          .from("profiles")
          .select("id")
          .eq("line_user_id", lineUserId)
          .maybeSingle();
        if (!profile) {
          await replyLineText(
            replyToken,
            "🔄 กรุณาเข้าสู่ระบบผ่าน Web App ก่อน\n" + appUrl
          );
          return;
        }
        const { error } = await admin.rpc("cancel_registration", {
          p_game_id: gameId,
          p_profile_id: profile.id,
        });
        if (error) {
          await replyLineText(
            replyToken,
            "❌ ถอนตัวไม่สำเร็จ — คุณอาจยังไม่ได้ลงชื่อ"
          );
          return;
        }
        await replyWithRoster(admin, replyToken, gameId);
        return;
      }

      if (!group) {
        await replyLineText(
          replyToken,
          "❌ ยังไม่ได้ผูก LINE Group นี้กับก๊วนในแอป"
        );
        return;
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .eq("line_user_id", lineUserId)
        .maybeSingle();
      if (!profile) {
        await replyLineText(
          replyToken,
          "🔄 กรุณาเข้าสู่ระบบผ่าน Web App ก่อน\n" + appUrl
        );
        return;
      }

      // Find open sessions in this group that the user is registered in
      const now = new Date().toISOString();
      const { data: myRegs } = await admin
        .from("registrations")
        .select("game_id, status, games!inner(id, title, starts_at, status, group_id)")
        .eq("profile_id", profile.id)
        .eq("games.group_id", group.id)
        .eq("games.status", "open")
        .gte("games.ends_at", now)
        .in("status", ["confirmed", "waitlisted"])
        .order("games(starts_at)", { ascending: true })
        .limit(5);

      if (!myRegs || myRegs.length === 0) {
        await replyLineText(
          replyToken,
          "❌ คุณยังไม่ได้ลงชื่อใน Session ที่เปิดรับของก๊วนนี้"
        );
        return;
      }

      if (myRegs.length === 1) {
        const reg = myRegs[0];
        const g = reg.games as unknown as { id: string };
        const { error } = await admin.rpc("cancel_registration", {
          p_game_id: g.id,
          p_profile_id: profile.id,
        });
        if (error) {
          await replyLineText(
            replyToken,
            "❌ ถอนตัวไม่สำเร็จ"
          );
          return;
        }
        await replyWithRoster(admin, replyToken, g.id);
      } else {
        // Multiple sessions the user is registered in → show picker
        const pickGames: OpenGameBrief[] = myRegs.map((r) => {
          const g = r.games as unknown as OpenGameBrief;
          return { id: g.id, title: g.title, starts_at: g.starts_at };
        });
        await replySessionPicker(replyToken, group.name, pickGames);
      }
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
        await replyLineText(
          replyToken,
          "🔄 กรุณาเข้าสู่ระบบผ่าน Web App ก่อน\n" + appUrl
        );
        return;
      }

      let query = admin
        .from("registrations")
        .select("game_id, status, games!inner(title, starts_at, status, group_id)")
        .eq("profile_id", profile.id)
        .in("games.status", ["open", "completed"])
        .order("games(starts_at)", { ascending: false })
        .limit(5);

      if (group) {
        // Scope to this group's games
        query = query.eq("games.group_id", group.id);
      }

      const { data: regs } = await query;

      if (!regs || regs.length === 0) {
        if (group) {
          await replyLineText(
            replyToken,
            `📭 คุณยังไม่ได้ลงชื่อใน Session ของก๊วนนี้`
          );
        } else {
          await replyLineText(
            replyToken,
            "📭 คุณยังไม่ได้ลงชื่อใน Session ไหนเลย"
          );
        }
        return;
      }
      const lines = regs.map((r) => {
        const g = (r.games as unknown) as {
          title: string;
          starts_at: string;
          status: string;
        };
        const statusMap: Record<string, string> = {
          confirmed: "✅ ตัวจริง",
          waitlisted: "⏳ สำรอง",
          tentative: "🤷 ไม่แน่นอน",
        };
        return `• ${g.title} — ${statusMap[r.status] ?? r.status}`;
      });
      await replyLineText(
        replyToken,
        `📋 สถานะของคุณ${group ? ` ใน ${group.name}` : ""}:\n` +
          lines.join("\n")
      );
      return;
    }
  }
}

/** LINE Messaging API webhook */
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

/** Show available games (optionally scoped to a group) */
async function replyGamesList(
  admin: AdminClient,
  replyToken: string,
  groupId?: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  let query = admin
    .from("games")
    .select("id, title, starts_at, location, max_players")
    .eq("status", "open")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(10);

  if (groupId) {
    query = query.eq("group_id", groupId);
  }

  const { data: games } = await query;

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
      .select(
        "title, starts_at, location, notes, max_players, groups!group_id(name)"
      )
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
