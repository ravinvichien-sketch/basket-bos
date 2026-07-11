import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLegendForStats, TIER_LABELS, TIER_COLORS } from "@/features/stats/lib/legend-cards";

export const runtime = "nodejs";
export const maxDuration = 30;

const fontCache = new Map<number, ArrayBuffer>();

async function loadFont(weight: 400 | 800): Promise<ArrayBuffer> {
  const cached = fontCache.get(weight);
  if (cached) return cached;
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@${weight}&display=swap`,
    { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1)" } }
  ).then((r) => r.text());
  const url = css.match(/src:\s*url\((.+?)\)\s*format\('(?:truetype|opentype|woff2)'\)/)?.[1];
  if (!url) throw new Error("font url not found");
  const data = await fetch(url).then((r) => r.arrayBuffer());
  fontCache.set(weight, data);
  return data;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ gameId: string; profileId: string }> }
) {
  try {
    const { gameId, profileId } = await params;
    const { searchParams } = new URL(req.url);
    const useNba = searchParams.get("nba") === "1";
    const admin = createAdminClient();

    const [
      { data: profile },
      { data: game },
      { data: stats },
      { data: matchesData },
      { data: cardGen },
    ] = await Promise.all([
      admin.from("profiles").select("id, nickname, avatar_url").eq("id", profileId).single(),
      admin.from("games").select("id, title, location, starts_at, game_duration_minutes").eq("id", gameId).single(),
      admin.from("player_game_stats").select("*").eq("game_id", gameId).eq("profile_id", profileId),
      admin.from("matches").select("id, team_a_name, team_b_name, score_a, score_b, status").eq("game_id", gameId).eq("status", "finished").order("created_at"),
      admin.from("player_card_generations").select("card_url, nba_player_name, nba_player_tier, nba_player_image_url").eq("game_id", gameId).eq("profile_id", profileId).maybeSingle(),
    ]);

    if (!profile || !game) return new Response("not found", { status: 404 });

  const statRows = (stats ?? []) as {
    points: number; assists: number; reb_off: number; reb_def: number;
    steals: number; blocks: number; turnovers: number; fouls: number; minutes: number;
    fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number;
    is_mvp: boolean; plus_minus: number | null;
  }[];
  const matches = (matchesData ?? []) as { id: string; team_a_name: string | null; team_b_name: string | null; score_a: number; score_b: number }[];

  const totals = {
    games: statRows.length,
    points: 0, assists: 0, reb: 0, steals: 0, blocks: 0, fouls: 0, minutes: 0, turnovers: 0,
    fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
    mvpCount: 0,
  };
  for (const s of statRows) {
    totals.points += s.points; totals.assists += s.assists;
    totals.reb += s.reb_off + s.reb_def; totals.steals += s.steals;
    totals.blocks += s.blocks; totals.fouls += s.fouls; totals.turnovers += s.turnovers;
    totals.minutes += s.minutes; totals.fgm += s.fgm; totals.fga += s.fga;
    totals.tpm += s.tpm; totals.tpa += s.tpa; totals.ftm += s.ftm; totals.fta += s.fta;
    if (s.is_mvp) totals.mvpCount += 1;
  }

  const fgPct = totals.fga > 0 ? Math.round((totals.fgm / totals.fga) * 100) : null;
  const tpPct = totals.tpa > 0 ? Math.round((totals.tpm / totals.tpa) * 100) : null;
  const ppg = totals.games > 0 ? (totals.points / totals.games).toFixed(1) : "0";
  const rpg = totals.games > 0 ? (totals.reb / totals.games).toFixed(1) : "0";
  const apg = totals.games > 0 ? (totals.assists / totals.games).toFixed(1) : "0";

  const avatarUrl = profile.avatar_url || null;

  const dateStr = new Date(game.starts_at).toLocaleDateString("th-TH", {
    year: "numeric", month: "long", day: "numeric",
  });

  const [fontRegular, fontBold] = await Promise.all([
    loadFont(400),
    loadFont(800),
  ]);

  // ── NBA Player logic ──
  let nbaPlayer = cardGen as { nba_player_name: string | null; nba_player_tier: string | null; nba_player_image_url: string | null } | null;

  if (useNba && !nbaPlayer?.nba_player_name) {
    const picked = getLegendForStats({
      points: totals.points, assists: totals.assists,
      rebounds: totals.reb, steals: totals.steals,
      blocks: totals.blocks, fga: totals.fga, fgm: totals.fgm,
      games: totals.games,
    });
    await admin.from("player_card_generations").upsert(
      {
        game_id: gameId,
        profile_id: profileId,
        nba_player_name: picked.name,
        nba_player_tier: picked.tier,
        nba_player_image_url: picked.imageUrl,
      },
      { onConflict: "game_id,profile_id", ignoreDuplicates: false }
    );
    nbaPlayer = {
      nba_player_name: picked.name,
      nba_player_tier: picked.tier,
      nba_player_image_url: picked.imageUrl,
    };
  }

  // ไม่ใช้รูปภายนอกเป็นพื้นหลังอีกต่อไป (เลี่ยง fetch ล้มเหลว + ลิขสิทธิ์) — ใช้ gradient ตาม tier
  const nbaImageUrl = null;
  const nbaName = nbaPlayer?.nba_player_name || null;
  const nbaTier = (nbaPlayer?.nba_player_tier || "solid") as keyof typeof TIER_LABELS;

  // Color scheme
  const avgGs = totals.games > 0
    ? (totals.points + 0.7 * totals.assists + 0.7 * totals.reb + totals.steals + 0.7 * totals.blocks - totals.fouls - totals.turnovers) / totals.games
    : 0;
  const accent = avgGs >= 15 ? "#F59E0B" : avgGs >= 10 ? "#10B981" : avgGs >= 5 ? "#3B82F6" : "#8B5CF6";
  const gradient = avgGs >= 15
    ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)"
    : "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)";

  const avatarBorderColor = accent;

  const Cell = ({ children, colSpan = 1, rowSpan = 1, bg = "rgba(255,255,255,0.06)", br = 24, p = 20 }: {
    children: React.ReactNode; colSpan?: number; rowSpan?: number; bg?: string; br?: number; p?: number;
  }) => (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: bg, borderRadius: br, padding: p,
      gridColumn: `span ${colSpan}`, gridRow: `span ${rowSpan}`,
    }}>
      {children}
    </div>
  );

  const bgStyle = nbaImageUrl
    ? { backgroundImage: `url(${nbaImageUrl})`, backgroundSize: "cover" as const, backgroundPosition: "center" as const }
    : { background: gradient };

  const tierColor = TIER_COLORS[nbaTier] || accent;

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex",
        color: "#ffffff",
        fontFamily: "NotoThai",
        position: "relative", overflow: "hidden",
        ...bgStyle,
      }}>
        {/* Overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: nbaImageUrl
            ? "linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.7) 100%)"
            : "radial-gradient(circle at 25% 50%, rgba(255,255,255,0.03) 0%, transparent 50%)",
        }} />

        <div style={{
          display: "flex", flexDirection: "column",
          padding: "48px", gap: 20, width: "100%", position: "relative", zIndex: 1,
        }}>
          {/* Legend badge */}
          {nbaName && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              background: `${tierColor}22`, borderRadius: 100, padding: "8px 20px 8px 12px",
              alignSelf: "flex-start",
              border: `2px solid ${tierColor}44`,
            }}>
              <span style={{ fontSize: 24 }}>🏀</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: tierColor }}>{nbaName}</span>
                <span style={{ fontSize: 13, opacity: 0.7 }}>{TIER_LABELS[nbaTier]}</span>
              </div>
            </div>
          )}

          {/* Header - Bento header row */}
          <div style={{ display: "flex", gap: 20, height: 120 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 20, flex: 2,
              background: "rgba(255,255,255,0.06)", borderRadius: 24, padding: "12px 24px",
            }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  width={80} height={80}
                  style={{ borderRadius: "50%", border: `4px solid ${avatarBorderColor}`, objectFit: "cover" }}
                />
              ) : (
                <div style={{
                  width: 80, height: 80, borderRadius: "50%",
                  border: `4px solid ${avatarBorderColor}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(255,255,255,0.1)", fontSize: 36,
                }}>🏀</div>
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.1 }}>{profile.nickname}</span>
                <span style={{ fontSize: 18, opacity: 0.7, marginTop: 4 }}>{totals.games} เกมส์ · {totals.minutes} นาที</span>
              </div>
            </div>
            <div style={{
              display: "flex", flexDirection: "column", justifyContent: "center", flex: 1,
              background: "rgba(255,255,255,0.06)", borderRadius: 24, padding: "12px 20px",
            }}>
              <span style={{ fontSize: 14, opacity: 0.6 }}>SESSION</span>
              <span style={{ fontSize: 20, fontWeight: 800 }}>{game.title}</span>
              <span style={{ fontSize: 13, opacity: 0.7 }}>{game.location ?? ""} · {dateStr}</span>
            </div>
          </div>

          {/* Bento main grid - 4 columns */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gridAutoRows: 120,
            gap: 16,
          }}>
            <Cell colSpan={2} rowSpan={2}>
              <span style={{ fontSize: 80, fontWeight: 800, lineHeight: 1, color: accent }}>{totals.points}</span>
              <span style={{ fontSize: 18, letterSpacing: 4, opacity: 0.6, marginTop: 4 }}>คะแนนรวม</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: accent }}>{ppg}</span>
              <span style={{ fontSize: 13, opacity: 0.5 }}>PPG</span>
            </Cell>

            <Cell>
              <span style={{ fontSize: 28, fontWeight: 800, color: accent }}>{fgPct !== null ? `${fgPct}%` : "-"}</span>
              <span style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>2PT</span>
              <span style={{ fontSize: 12, opacity: 0.5 }}>{totals.fgm}/{totals.fga}</span>
            </Cell>

            <Cell>
              <span style={{ fontSize: 28, fontWeight: 800, color: accent }}>{tpPct !== null ? `${tpPct}%` : "-"}</span>
              <span style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>3PT</span>
              <span style={{ fontSize: 12, opacity: 0.5 }}>{totals.tpm}/{totals.tpa}</span>
            </Cell>

            <Cell>
              <span style={{ fontSize: 28, fontWeight: 800, color: accent }}>{totals.assists}</span>
              <span style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>แอสซิสต์</span>
              <span style={{ fontSize: 12, opacity: 0.5 }}>{apg}/G</span>
            </Cell>

            <Cell>
              <span style={{ fontSize: 28, fontWeight: 800, color: accent }}>{totals.reb}</span>
              <span style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>รีบาวด์</span>
              <span style={{ fontSize: 12, opacity: 0.5 }}>{rpg}/G</span>
            </Cell>

            <Cell>
              <span style={{ fontSize: 28, fontWeight: 800, color: accent }}>{totals.steals}</span>
              <span style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>สตีล</span>
            </Cell>

            <Cell>
              <span style={{ fontSize: 28, fontWeight: 800, color: accent }}>{totals.blocks}</span>
              <span style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>บล็อก</span>
            </Cell>

            <Cell>
              <span style={{ fontSize: 28, fontWeight: 800, color: totals.points > totals.fouls * 2 ? "#10B981" : "#EF4444" }}>
                {totals.points - totals.fouls * 2 > 0 ? "+" : ""}{totals.points - totals.fouls * 2}
              </span>
              <span style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>IMPACT</span>
            </Cell>

            <Cell colSpan={2} bg="rgba(255,255,255,0.04)">
              <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: 32, fontWeight: 800, color: accent }}>{totals.games}</span>
                  <span style={{ fontSize: 13, opacity: 0.6 }}>GAMES</span>
                </div>
                {totals.mvpCount > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span style={{ fontSize: 32, fontWeight: 800, color: "#F59E0B" }}>{totals.mvpCount}</span>
                    <span style={{ fontSize: 13, opacity: 0.6 }}>MVP 👑</span>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: 32, fontWeight: 800, color: accent }}>{totals.fouls}</span>
                  <span style={{ fontSize: 13, opacity: 0.6 }}>ฟาวล์</span>
                </div>
              </div>
            </Cell>
          </div>

          {/* Per-game mini breakdown */}
          {matches.length > 0 && (
            <div style={{
              display: "flex", gap: 8, overflow: "hidden",
              background: "rgba(255,255,255,0.04)", borderRadius: 24, padding: "16px 20px",
            }}>
              {matches.slice(0, 5).map((m, i) => {
                const row = statRows[i];
                const pts = row?.points ?? 0;
                const ast = row?.assists ?? 0;
                const reb = (row?.reb_off ?? 0) + (row?.reb_def ?? 0);
                return (
                  <div key={m.id} style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    flex: 1, padding: "8px 4px",
                    background: i % 2 === 0 ? "rgba(255,255,255,0.04)" : "transparent",
                    borderRadius: 12,
                  }}>
                    <span style={{ fontSize: 11, opacity: 0.5 }}>G{i+1}</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: accent, marginTop: 4 }}>{pts}</span>
                    <span style={{ fontSize: 11, opacity: 0.7 }}>{ast}A {reb}R</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div style={{
            display: "flex", justifyContent: "center", marginTop: "auto", paddingTop: 12,
          }}>
            <span style={{ fontSize: 14, letterSpacing: 6, opacity: 0.4 }}>
              BASKETBOS.APP
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: [
        { name: "NotoThai", data: fontRegular, weight: 400 },
        { name: "NotoThai", data: fontBold, weight: 800 },
      ],
    }
  );
  } catch (err) {
    console.error("session-card error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
