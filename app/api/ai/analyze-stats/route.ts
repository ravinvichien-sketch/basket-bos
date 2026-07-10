import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM_PROMPT =
  "You are an expert basketball coach. Analyze the player's stats from this session " +
  "and provide a concise performance evaluation in Thai. " +
  "Format your response as JSON with these keys:\n" +
  "- strengths: array of 2-3 bullet points (what they did well)\n" +
  "- weaknesses: array of 2-3 bullet points (what needs improvement)\n" +
  "- tips: array of 2-3 bullet points (specific advice)\n" +
  "- grade: one of A/B/C/D (A=exceptional, B=good, C=needs work, D=poor)\n" +
  "- summary: one-line overall assessment (Thai, max 100 chars)\n\n" +
  "Be honest but constructive. Compare to recreational basketball level. " +
  "Never mention AI or that this is an automated analysis. " +
  "Output ONLY valid JSON, no markdown fences.";

interface PerMatch {
  score: string;
  points: number;
  fgm: number; fga: number;
  tpm: number; tpa: number;
  ftm: number; fta: number;
  assists: number;
  reb_off: number; reb_def: number;
  steals: number; blocks: number;
  turnovers: number; fouls: number;
  plus_minus: number;
  is_mvp: boolean;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { gameId, profileId } = await req.json();
  if (!gameId || !profileId) {
    return NextResponse.json({ error: "Missing gameId or profileId" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  if (profileId !== user.id && !isAdmin) {
    return NextResponse.json({ error: "คุณสามารถวิเคราะห์สถิติของตัวเองเท่านั้น" }, { status: 403 });
  }

  const { data: game } = await supabase
    .from("games")
    .select("title")
    .eq("id", gameId)
    .single();
  if (!game) return NextResponse.json({ error: "ไม่พบ Session" }, { status: 404 });

  const { data: stats } = await supabase
    .from("player_game_stats")
    .select("*, matches!inner(score_a, score_b, team_a_name, team_b_name)")
    .eq("game_id", gameId)
    .eq("profile_id", profileId)
    .not("match_id", "is", null);

  let perMatch: PerMatch[];

  if (!stats || stats.length === 0) {
    const { data: sessionStats } = await supabase
      .from("player_game_stats")
      .select("*")
      .eq("game_id", gameId)
      .eq("profile_id", profileId)
      .is("match_id", null);

    if (!sessionStats || sessionStats.length === 0) {
      return NextResponse.json({ error: "ไม่มีสถิติของผู้เล่นนี้ใน Session" }, { status: 404 });
    }

    const s = sessionStats[0];
    perMatch = [{
      score: "-",
      points: s.points, fgm: s.fgm, fga: s.fga,
      tpm: s.tpm, tpa: s.tpa, ftm: s.ftm, fta: s.fta,
      assists: s.assists,
      reb_off: s.reb_off, reb_def: s.reb_def,
      steals: s.steals, blocks: s.blocks,
      turnovers: s.turnovers, fouls: s.fouls,
      plus_minus: s.plus_minus ?? 0,
      is_mvp: s.is_mvp,
    }];
  } else {
    perMatch = stats.map((s: Record<string, unknown>) => {
      const m = s.matches as { score_a: number; score_b: number; team_a_name: string | null; team_b_name: string | null };
      return {
        score: `${m.score_a}-${m.score_b}`,
        points: s.points as number, fgm: s.fgm as number, fga: s.fga as number,
        tpm: s.tpm as number, tpa: s.tpa as number,
        ftm: s.ftm as number, fta: s.fta as number,
        assists: s.assists as number,
        reb_off: s.reb_off as number, reb_def: s.reb_def as number,
        steals: s.steals as number, blocks: s.blocks as number,
        turnovers: s.turnovers as number, fouls: s.fouls as number,
        plus_minus: (s.plus_minus as number) ?? 0,
        is_mvp: s.is_mvp as boolean,
      };
    });
  }

  // Try to get user's AI settings, but don't fail if table doesn't exist
  let provider = "default";
  let userApiKey: string | null = null;
  try {
    const { data: aiSettings } = await supabase
      .from("user_ai_settings")
      .select("provider, api_key")
      .eq("profile_id", user.id)
      .single();
    if (aiSettings) {
      provider = aiSettings.provider ?? "default";
      userApiKey = aiSettings.api_key;
    }
  } catch {
    // table not exist or other error — use default
  }

  if (provider === "default" || provider === "groq") {
    return callGroq(game.title, perMatch, userApiKey);
  } else if (provider === "gemini") {
    return callGeminiViaSDK(game.title, perMatch, userApiKey);
  } else if (provider === "openai") {
    return callOpenAI(game.title, perMatch, userApiKey);
  } else if (provider === "anthropic") {
    return callAnthropic(game.title, perMatch, userApiKey);
  }

  return callGroq(game.title, perMatch, null);
}

// ---- Prompt builder ----

function buildPrompt(sessionTitle: string, matches: PerMatch[]): string {
  const totals = matches.reduce(
    (acc, m) => {
      acc.games++;
      acc.points += m.points;
      acc.fgm += m.fgm; acc.fga += m.fga;
      acc.tpm += m.tpm; acc.tpa += m.tpa;
      acc.ftm += m.ftm; acc.fta += m.fta;
      acc.assists += m.assists;
      acc.reb_off += m.reb_off; acc.reb_def += m.reb_def;
      acc.steals += m.steals; acc.blocks += m.blocks;
      acc.turnovers += m.turnovers; acc.fouls += m.fouls;
      acc.plusMinus += m.plus_minus;
      if (m.is_mvp) acc.mvpCount++;
      return acc;
    },
    { games: 0, points: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
      assists: 0, reb_off: 0, reb_def: 0, steals: 0, blocks: 0,
      turnovers: 0, fouls: 0, plusMinus: 0, mvpCount: 0 }
  );

  const tpPct = totals.tpa > 0 ? Math.round((totals.tpm / totals.tpa) * 100) : null;
  const fgPct = totals.fga > 0 ? Math.round((totals.fgm / totals.fga) * 100) : null;
  const ftPct = totals.fta > 0 ? Math.round((totals.ftm / totals.fta) * 100) : null;

  const matchesText = matches
    .map((m, i) => {
      const tp = m.tpa > 0 ? `${Math.round((m.tpm / m.tpa) * 100)}%` : "-";
      return `เกมส์ ${i + 1} (สกอร์ ${m.score}): ${m.points}pts, FG ${m.fgm}/${m.fga}, 3P ${m.tpm}/${m.tpa} (${tp}), FT ${m.ftm}/${m.fta}, AST ${m.assists}, REB ${m.reb_off + m.reb_def}, STL ${m.steals}, BLK ${m.blocks}, TO ${m.turnovers}, PF ${m.fouls}, +/- ${m.plus_minus}${m.is_mvp ? " 👑MVP" : ""}`;
    })
    .join("\n");

  return (
    `Session: ${sessionTitle}\n` +
    `ผู้เล่นลง ${totals.games} เกมส์\n` +
    `รวม: ${totals.points}pts, FG ${totals.fgm}/${totals.fga} (${fgPct ?? "-"}%), 3P ${totals.tpm}/${totals.tpa} (${tpPct ?? "-"}%), FT ${totals.ftm}/${totals.fta} (${ftPct ?? "-"}%)\n` +
    `REB ${totals.reb_off + totals.reb_def} (รุก ${totals.reb_off} / รับ ${totals.reb_def}), AST ${totals.assists}, STL ${totals.steals}, BLK ${totals.blocks}, TO ${totals.turnovers}, PF ${totals.fouls}, +/- ${totals.plusMinus}, MVP ${totals.mvpCount} ครั้ง\n\n` +
    `รายเกมส์:\n${matchesText}`
  );
}

function parseResponse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (m) {
      try { return JSON.parse(m[1]); } catch { return null; }
    }
    return null;
  }
}

function successResponse(parsed: Record<string, unknown>) {
  return NextResponse.json({
    grade: parsed.grade ?? "C",
    summary: parsed.summary ?? "",
    strengths: parsed.strengths ?? [],
    weaknesses: parsed.weaknesses ?? [],
    tips: parsed.tips ?? [],
  });
}

// ---- Provider: Groq (free, no CC needed) ----

async function callGroq(sessionTitle: string, matches: PerMatch[], userKey: string | null) {
  const apiKey = userKey || process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      grade: "-",
      summary: "🔒 ยังไม่ได้ตั้ง GROQ_API_KEY — ไปสมัคร https://console.groq.com (ฟรี ไม่ต้องใช้บัตร) แล้วเอา Key มาใส่ใน Settings",
      strengths: [], weaknesses: [], tips: [],
    });
  }

  const userPrompt = buildPrompt(sessionTitle, matches);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Groq error: ${err}` }, { status: 502 });
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content ?? "";
    const parsed = parseResponse(text);
    if (!parsed) return NextResponse.json({ error: "AI ส่งข้อมูลผิดพลาด" }, { status: 502 });
    return successResponse(parsed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `AI ไม่สามารถวิเคราะห์ได้: ${msg}` }, { status: 502 });
  }
}

// ---- Provider: Gemini (via official SDK) ----

async function callGeminiViaSDK(sessionTitle: string, matches: PerMatch[], userKey: string | null) {
  const apiKey = userKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      grade: "-",
      summary: "🔒 ยังไม่ได้ตั้ง GEMINI_API_KEY — ไปที่ Settings แล้วใส่ API Key ของคุณ หรือให้ admin ตั้งค่า server",
      strengths: [], weaknesses: [], tips: [],
    });
  }

  const userPrompt = buildPrompt(sessionTitle, matches);
  const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: fullPrompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 800,
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json({ error: "AI ไม่ได้ส่งผลลัพธ์กลับมา" }, { status: 502 });
    }

    const parsed = parseResponse(text);
    if (!parsed) {
      return NextResponse.json({ error: "AI ส่งข้อมูลผิดพลาด" }, { status: 502 });
    }
    return successResponse(parsed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Gemini SDK error:", msg);
    return NextResponse.json({ error: `AI ไม่สามารถวิเคราะห์ได้: ${msg}` }, { status: 502 });
  }
}

// ---- Provider: OpenAI ----

async function callOpenAI(sessionTitle: string, matches: PerMatch[], userApiKey: string | null) {
  const apiKey = userApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      grade: "-",
      summary: "🔒 ไม่ได้ตั้งค่า OpenAI API Key — ไปที่ Settings > ตั้งค่า AI เพื่อเพิ่ม API Key",
      strengths: [], weaknesses: [], tips: [],
    });
  }

  const userPrompt = buildPrompt(sessionTitle, matches);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `OpenAI error: ${err}` }, { status: 502 });
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content ?? "";
    const parsed = parseResponse(text);
    if (!parsed) return NextResponse.json({ error: "AI ส่งข้อมูลผิดพลาด" }, { status: 502 });
    return successResponse(parsed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `AI ไม่สามารถวิเคราะห์ได้: ${msg}` }, { status: 502 });
  }
}

// ---- Provider: Anthropic ----

async function callAnthropic(sessionTitle: string, matches: PerMatch[], userApiKey: string | null) {
  const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      grade: "-",
      summary: "🔒 ไม่ได้ตั้งค่า Anthropic API Key — ไปที่ Settings > ตั้งค่า AI เพื่อเพิ่ม API Key",
      strengths: [], weaknesses: [], tips: [],
    });
  }

  const userPrompt = buildPrompt(sessionTitle, matches);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Anthropic error: ${err}` }, { status: 502 });
    }

    const json = await res.json();
    const text = json.content?.[0]?.text ?? "";
    const parsed = parseResponse(text);
    if (!parsed) return NextResponse.json({ error: "AI ส่งข้อมูลผิดพลาด" }, { status: 502 });
    return successResponse(parsed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `AI ไม่สามารถวิเคราะห์ได้: ${msg}` }, { status: 502 });
  }
}
