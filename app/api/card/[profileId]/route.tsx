import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeOvr,
  tierOf,
  type SeasonStats,
} from "@/features/stats/lib/ratings";

export const runtime = "nodejs";
export const maxDuration = 30;

const fontCache = new Map<number, ArrayBuffer>();

/** Fetch Noto Sans Thai TTF from Google Fonts (legacy UA → truetype URLs). */
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
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const admin = createAdminClient();

  const [{ data: profile }, { data: positions }, { data: season }] =
    await Promise.all([
      admin.from("profiles").select("*").eq("id", profileId).single(),
      admin
        .from("player_positions")
        .select("position, priority")
        .eq("profile_id", profileId)
        .order("priority"),
      admin
        .from("v_player_season_stats")
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle(),
    ]);

  if (!profile) return new Response("not found", { status: 404 });

  const stats: SeasonStats | null = season
    ? {
        games_played: Number(season.games_played),
        ppg: Number(season.ppg ?? 0),
        rpg: Number(season.rpg ?? 0),
        apg: Number(season.apg ?? 0),
        spg: Number(season.spg ?? 0),
        bpg: Number(season.bpg ?? 0),
        fg_pct: season.fg_pct != null ? Number(season.fg_pct) : null,
        mvp_count: Number(season.mvp_count ?? 0),
      }
    : null;

  const ovr = computeOvr(stats);
  const tier = tierOf(ovr);
  const photo =
    profile.card_photo_cutout_url ??
    profile.card_photo_url ??
    profile.avatar_url;
  const posList = (positions ?? []).map((p) => p.position);

  const [fontRegular, fontBold] = await Promise.all([
    loadFont(400),
    loadFont(800),
  ]);

  const statBlock = (value: string, label: string) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: 1,
      }}
    >
      <span style={{ fontSize: 88, fontWeight: 800, lineHeight: 1 }}>
        {value}
      </span>
      <span
        style={{
          fontSize: 26,
          letterSpacing: 8,
          opacity: 0.7,
          marginTop: 10,
        }}
      >
        {label}
      </span>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          background: tier.gradient,
          color: "#ffffff",
          fontFamily: "NotoThai",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: 10,
              opacity: 0.85,
              marginTop: 24,
            }}
          >
            BASKET BOS · {tier.label}
          </span>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <span
              style={{
                fontSize: 190,
                fontWeight: 800,
                lineHeight: 1,
                color: tier.accent,
              }}
            >
              {ovr}
            </span>
            <span style={{ fontSize: 26, letterSpacing: 10, opacity: 0.7 }}>
              OVR
            </span>
          </div>
        </div>

        {/* hero */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 48,
            marginTop: 24,
            flex: 1,
          }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              width={420}
              height={420}
              style={{
                width: 420,
                height: 420,
                objectFit: "cover",
                borderRadius: 40,
                border: `8px solid ${tier.accent}`,
              }}
            />
          ) : (
            <div
              style={{
                width: 420,
                height: 420,
                borderRadius: 40,
                border: `8px solid ${tier.accent}`,
                background: "rgba(255,255,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 160,
              }}
            >
              🏀
            </div>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            <span
              style={{
                fontSize: 92,
                fontWeight: 800,
                lineHeight: 1.05,
              }}
            >
              {profile.nickname}
            </span>
            <span style={{ fontSize: 34, opacity: 0.75, marginTop: 14 }}>
              {profile.height_cm ?? "–"} ซม. · {profile.weight_kg ?? "–"} กก.
            </span>
            <div style={{ display: "flex", gap: 14, marginTop: 24 }}>
              {posList.map((p) => (
                <span
                  key={p}
                  style={{
                    fontSize: 34,
                    fontWeight: 800,
                    padding: "10px 22px",
                    borderRadius: 14,
                    background: "rgba(0,0,0,0.35)",
                    color: tier.accent,
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* stat row */}
        <div
          style={{
            display: "flex",
            background: "rgba(0,0,0,0.3)",
            borderRadius: 32,
            padding: "44px 24px",
          }}
        >
          {statBlock((stats?.ppg ?? 0).toFixed(1), "PTS")}
          {statBlock((stats?.rpg ?? 0).toFixed(1), "REB")}
          {statBlock((stats?.apg ?? 0).toFixed(1), "AST")}
          {statBlock(
            stats?.fg_pct != null ? `${Math.round(stats.fg_pct)}%` : "–",
            "FG"
          )}
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 40,
          }}
        >
          <span style={{ fontSize: 26, letterSpacing: 12, opacity: 0.6 }}>
            {stats && stats.games_played > 0
              ? `${stats.games_played} GAMES · ${
                  stats.mvp_count > 0 ? `MVP ×${stats.mvp_count} · ` : ""
                }BASKETBOS.APP`
              : "ROOKIE SEASON · BASKETBOS.APP"}
          </span>
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
}
