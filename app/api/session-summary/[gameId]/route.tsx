import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSessionSummary } from "@/features/games/lib/summary";

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
  const url = css.match(/src:\s*url\((.+?)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
  if (!url) throw new Error("font url not found");
  const data = await fetch(url).then((r) => r.arrayBuffer());
  fontCache.set(weight, data);
  return data;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const supabase = createAdminClient();
  const summary = await buildSessionSummary(supabase, gameId);
  if (!summary) return new Response("not found", { status: 404 });

  const dateStr = new Date(summary.date).toLocaleDateString("th-TH", {
    year: "numeric", month: "long", day: "numeric",
  });

  const [fontRegular, fontBold] = await Promise.all([
    loadFont(400),
    loadFont(800),
  ]);

  const medal = (i: number) => ["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "48px 56px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          color: "#ffffff",
          fontFamily: "NotoThai",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <span style={{ fontSize: 40 }}>🏀</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: 4 }}>
              BASKET BOS
            </span>
            <span style={{ fontSize: 20, opacity: 0.7 }}>
              {dateStr} · {summary.title}
            </span>
          </div>
        </div>

        {/* Standings */}
        <div
          style={{
            background: "rgba(255,255,255,0.08)",
            borderRadius: 24,
            padding: "24px 28px",
            marginBottom: 28,
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 800, opacity: 0.8, marginBottom: 16, display: "block" }}>
            🏆 อันดับทีม
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {summary.standings.map((s, i) => (
              <div
                key={s.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 20,
                }}
              >
                <span style={{ width: 36, textAlign: "center" }}>{medal(i)}</span>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    backgroundColor: s.color,
                  }}
                />
                <span style={{ flex: 1, fontWeight: 700 }}>{s.name}</span>
                <span style={{ opacity: 0.7 }}>
                  <span style={{ color: "#34d399", fontWeight: 700 }}>{s.wins}W</span>
                  {" / "}
                  <span style={{ color: "#f87171", fontWeight: 700 }}>{s.losses}L</span>
                </span>
                <span style={{ opacity: 0.6, fontSize: 18, marginLeft: 12 }}>
                  PF {s.pointsFor} · PA {s.pointsAgainst}
                </span>
                <span
                  style={{
                    fontWeight: 800,
                    color: s.pointsFor - s.pointsAgainst >= 0 ? "#34d399" : "#f87171",
                    marginLeft: 8,
                  }}
                >
                  {s.pointsFor - s.pointsAgainst >= 0 ? "+" : ""}
                  {s.pointsFor - s.pointsAgainst}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Leaders */}
        <div
          style={{
            background: "rgba(255,255,255,0.08)",
            borderRadius: 24,
            padding: "24px 28px",
            marginBottom: 28,
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 800, opacity: 0.8, marginBottom: 16, display: "block" }}>
            🔥 ผู้เล่นยอดเยี่ยม
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {summary.mvp && (
              <LeaderRow icon="🏆" label="MVP" value={summary.mvp.nickname} />
            )}
            {summary.topScorer && summary.topScorer.value > 0 && (
              <LeaderRow icon="🔥" label="แต้มสูงสุด" value={`${summary.topScorer.nickname} — ${summary.topScorer.value} pts`} />
            )}
            {summary.topRebounder && summary.topRebounder.value > 0 && (
              <LeaderRow icon="💪" label="รีบาวด์สูงสุด" value={`${summary.topRebounder.nickname} — ${summary.topRebounder.value} reb`} />
            )}
            {summary.topAssister && summary.topAssister.value > 0 && (
              <LeaderRow icon="🎯" label="แอสซิสต์สูงสุด" value={`${summary.topAssister.nickname} — ${summary.topAssister.value} ast`} />
            )}
            {summary.topStealer && summary.topStealer.value > 0 && (
              <LeaderRow icon="🖐" label="สตีลสูงสุด" value={`${summary.topStealer.nickname} — ${summary.topStealer.value} stl`} />
            )}
            {summary.topBlocker && summary.topBlocker.value > 0 && (
              <LeaderRow icon="🔒" label="บล็อกสูงสุด" value={`${summary.topBlocker.nickname} — ${summary.topBlocker.value} blk`} />
            )}
          </div>
        </div>

        {/* Totals */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            fontSize: 18,
            opacity: 0.6,
            letterSpacing: 2,
          }}
        >
          {summary.totalGames} เกม · {summary.totalPoints} แต้มทั้งหมด
        </div>
      </div>
    ),
    {
      width: 800,
      height: summary.standings.length > 3 ? 900 : 700,
      fonts: [
        { name: "NotoThai", data: fontRegular, weight: 400 },
        { name: "NotoThai", data: fontBold, weight: 800 },
      ],
    }
  );
}

function LeaderRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 18 }}>
      <span>{icon}</span>
      <span style={{ opacity: 0.7, minWidth: 140 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}
