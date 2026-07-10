"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveCardUrl } from "../actions";

interface MatchSummary {
  id: string;
  team_a_name: string | null;
  team_b_name: string | null;
  score_a: number;
  score_b: number;
}

interface PerMatchStat {
  match_id: string | null;
  points: number;
  assists: number;
  reb_off: number;
  reb_def: number;
  is_mvp: boolean;
  minutes: number;
}

interface ExistingCard {
  id: string;
  card_url: string | null;
  ai_image_url: string | null;
}

interface Totals {
  games: number;
  points: number;
  assists: number;
  reb_off: number;
  reb_def: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  minutes: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  mvpCount: number;
}

interface Props {
  gameId: string;
  profileId: string;
  totals: Totals;
  fgPct: number | null;
  tpPct: number | null;
  ftPct: number | null;
  ppg: string;
  rpg: string;
  apg: string;
  gameTitle: string;
  gameLocation: string;
  gameDate: string;
  existingCard: ExistingCard | null;
  matches: MatchSummary[];
  perMatchStats: PerMatchStat[];
}

export function PlayerCardGenerator({
  gameId,
  profileId,
  totals,
  existingCard,
  gameTitle = "Session",
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(
    existingCard?.card_url ?? null
  );
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(
    existingCard?.ai_image_url ?? null
  );

  async function handleGenerate() {
    setBusy(true);
    setError(null);

    try {
      // 1) Fetch the generated image from API
      const res = await fetch(`/api/session-card/${gameId}/${profileId}`);
      if (!res.ok) throw new Error("สร้างการ์ดไม่สำเร็จ");

      const blob = await res.blob();
      const file = new File([blob], `session-card-${gameId}.png`, {
        type: "image/png",
      });

      // 2) Upload to Supabase storage
      const filePath = `${gameId}/${profileId}/session-card.png`;
      const { data: upload, error: uploadError } = await supabase.storage
        .from("player_cards")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw new Error("อัปโหลดไม่สำเร็จ");

      // 3) Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("player_cards")
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // 4) Save to DB
      const saveRes = await saveCardUrl(gameId, profileId, publicUrl);
      if (saveRes.error) throw new Error(saveRes.error);

      setCardUrl(publicUrl);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    if (!cardUrl) return;
    try {
      const text = `🏀 สถิติของผมใน ${gameTitle}!\nดูเพิ่มเติมได้ที่: ${cardUrl}`;
      if (navigator.share) {
        await navigator.share({ title: "Basket Bos Card", text, url: cardUrl });
      } else {
        await navigator.clipboard.writeText(cardUrl);
        alert("✅ คัดลอกลิงก์แล้ว!");
      }
    } catch {
      // user cancelled
    }
  }

  async function handleGenerateAi() {
    setAiBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-player-image/${gameId}/${profileId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "สร้างรูปไม่สำเร็จ");
      setAiImageUrl(data.url);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Card generation */}
      {cardUrl ? (
        <div className="space-y-3">
          <a href={cardUrl} target="_blank" rel="noopener noreferrer">
            <Image
              src={cardUrl}
              alt="Player card"
              width={360}
              height={450}
              className="w-full max-w-sm mx-auto rounded-xl2 border border-white/10"
            />
          </a>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="flex-1 rounded-xl bg-court py-2.5 text-sm font-semibold text-white hover:bg-court-dark transition"
            >
              📤 แชร์
            </button>
            <a
              href={cardUrl}
              download={`session-card-${gameId}.png`}
              className="flex-1 rounded-xl bg-surface-overlay py-2.5 text-sm font-semibold text-center hover:bg-surface-overlay/70 transition"
            >
              💾 ดาวน์โหลด
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-dim">
            สร้างการ์ดสรุปสถิติของคุณใน Session นี้ (สร้างได้ครั้งเดียว)
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-surface-overlay/50 p-3 text-center">
              <span className="text-lg font-bold tabular-nums text-court">{totals.points}</span>
              <p className="text-ink-faint">คะแนน</p>
            </div>
            <div className="rounded-lg bg-surface-overlay/50 p-3 text-center">
              <span className="text-lg font-bold tabular-nums text-amber-400">{totals.assists}</span>
              <p className="text-ink-faint">แอสซิสต์</p>
            </div>
            <div className="rounded-lg bg-surface-overlay/50 p-3 text-center">
              <span className="text-lg font-bold tabular-nums text-emerald-400">{totals.reb_off + totals.reb_def}</span>
              <p className="text-ink-faint">รีบาวด์</p>
            </div>
            <div className="rounded-lg bg-surface-overlay/50 p-3 text-center">
              <span className="text-lg font-bold tabular-nums text-blue-400">{totals.steals + totals.blocks}</span>
              <p className="text-ink-faint">สตีล+บล็อก</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy}
            className="w-full rounded-xl bg-court py-3 text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
          >
            {busy ? "กำลังสร้าง..." : "🎴 สร้างการ์ด"}
          </button>
        </div>
      )}

      {/* AI Image generation */}
      <div className="border-t border-white/5 pt-4">
        <p className="text-sm font-semibold mb-2">รูปนักบาสแนว NBA</p>
        {aiImageUrl ? (
          <div className="space-y-2">
            <Image
              src={aiImageUrl}
              alt="AI Player Image"
              width={256}
              height={256}
              className="w-full max-w-xs mx-auto rounded-xl2 border border-white/10"
            />
            <p className="text-xs text-ink-faint text-center">สร้างไว้แล้ว 1 ครั้ง ไม่สามารถแก้ไขได้</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-ink-dim">
              ให้ AI สร้างรูปนักบาส NBA จากรูปโปรไฟล์และสถิติของคุณ (สร้างได้ครั้งเดียว)
            </p>
            <button
              type="button"
              onClick={handleGenerateAi}
              disabled={aiBusy}
              className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
            >
              {aiBusy ? "กำลังสร้าง... (ใช้เวลาประมาณ 30 วินาที)" : "🤖 ให้ AI สร้างรูป"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-xl bg-red-500/10 text-red-400 text-sm px-4 py-3 text-center">
          {error}
        </p>
      )}
    </div>
  );
}
