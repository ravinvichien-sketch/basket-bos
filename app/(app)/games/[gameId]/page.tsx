import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tryGetUser } from "@/features/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { adminRemovePlayer } from "@/features/registration/actions";
import { changeGameStatus, startMatchSession } from "@/features/games/actions";
import { GAME_STATUS_LABELS, GAME_STATUS_STYLES, STATUS_TRANSITIONS, TRANSITION_LABELS } from "@/features/games/constants";
import { JoinControls } from "@/features/registration/components/join-controls";
import { RealtimeRegistrations } from "@/features/registration/components/realtime-registrations";
import { AdminAddForm } from "@/features/registration/components/admin-add-form";
import { DeleteGameButton } from "@/features/games/components/delete-game-button";
import { DelegateAdminControl } from "@/features/games/components/delegate-admin-control";
import { StatKeeperManager } from "@/features/games/components/stat-keeper-manager";
import { GuestAddForm } from "@/features/registration/components/guest-add-form";
import { RefApproveButton } from "@/features/registration/components/ref-approve-button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatThaiDateTime, formatTimeRange, formatBaht } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GameStatus } from "@/types/database";
import { CompletedSessionSummary } from "@/features/stats/components/completed-session-summary";

interface RegRow {
  id: string;
  profile_id: string;
  status: "confirmed" | "waitlisted" | "tentative";
  registered_at: string;
  ref_profile_id: string | null;
  ref_approved: boolean;
  note: string | null;
  profiles: { nickname: string; avatar_url: string | null; is_guest: boolean } | null;
  ref: { nickname: string } | null;
}

function PlayerRow({
  index,
  reg,
  gameId,
  isAdmin,
  highlight,
  meId,
}: {
  index: number;
  reg: RegRow;
  gameId: string;
  isAdmin: boolean;
  highlight: boolean;
  meId: string;
}) {
  const isGuest = reg.profiles?.is_guest ?? false;
  // ป้ายผู้ชวน: "(เพื่อนของ X)" — ถ้ายังไม่อนุมัติจะขึ้น "รออนุมัติ"
  const refLabel = isGuest && reg.ref?.nickname ? reg.ref.nickname : null;
  const iAmRef = reg.ref_profile_id === meId;
  const needsMyApproval = isGuest && !reg.ref_approved && iAmRef;
  return (
    <li
      className={cn(
        "flex items-center gap-3 py-2",
        highlight && "text-court font-semibold"
      )}
    >
      <span className="w-6 text-right text-sm text-ink-faint tabular-nums">
        {index}.
      </span>
      <Link href={`/players/${reg.profile_id}`} className="shrink-0">
        {reg.profiles?.avatar_url ? (
          <Image
            src={reg.profiles.avatar_url}
            alt=""
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <span className="h-8 w-8 rounded-full bg-surface-overlay flex items-center justify-center text-sm">
            {isGuest ? "👤" : "🏀"}
          </span>
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/players/${reg.profile_id}`} className="block truncate text-sm hover:text-court transition">
          {reg.profiles?.nickname ?? "ผู้เล่น"}
          {reg.status === "confirmed" && (
            <span className="ml-1.5 text-[10px] text-green-400 font-semibold">✅ ตัวจริง</span>
          )}
          {reg.status === "tentative" && (
            <span className="ml-1.5 text-[10px] text-blue-400 font-semibold">🤷 ไม่แน่นอน</span>
          )}
          {reg.status === "waitlisted" && (
            <span className="ml-1.5 text-[10px] text-amber-400 font-semibold">⏳ สำรอง</span>
          )}
          {refLabel && (
            <span className="text-ink-faint font-normal"> (เพื่อนของ {refLabel})</span>
          )}
        </Link>
        {isGuest && reg.ref_profile_id && !reg.ref_approved && (
          <span className="text-[11px] text-amber-400">
            {iAmRef ? "รอคุณยืนยัน" : `รอ ${refLabel ?? "ผู้ชวน"} ยืนยัน`}
          </span>
        )}
        {reg.note && (
          <span className="block text-[11px] text-ink-faint truncate">📝 {reg.note}</span>
        )}
      </div>
      {needsMyApproval && (
        <RefApproveButton gameId={gameId} registrationId={reg.id} />
      )}
      {isAdmin && (
        <form action={adminRemovePlayer.bind(null, gameId, reg.profile_id)}>
          <button
            type="submit"
            aria-label="เอาออก"
            className="h-7 w-7 rounded-full bg-red-500/10 text-red-400 text-xs hover:bg-red-500/25 transition"
          >
            ✕
          </button>
        </form>
      )}
    </li>
  );
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const ctx = await tryGetUser();
  const supabase = ctx ? ctx.supabase : await createClient();
  const user = ctx?.user ?? null;
  const isAdmin = ctx?.isAdmin ?? false;

  const { data: game } = await supabase
    .from("games")
    .select("*, groups(name)")
    .eq("id", gameId)
    .single();
  if (!game) notFound();

  // ── Public snapshot (not logged in) ──
  if (!user) {
    const group = game.groups as { name?: string } | null;
    const { data: pubRegs } = await supabase
      .from("registrations")
      .select("status, profiles!profile_id(nickname)")
      .eq("game_id", gameId)
      .in("status", ["confirmed", "waitlisted", "tentative"])
      .order("registered_at", { ascending: true });

    const pConfirmed = (pubRegs ?? []).filter((r) => r.status === "confirmed");
    const pTentative = (pubRegs ?? []).filter((r) => r.status === "tentative");
    const pWaitlist = (pubRegs ?? []).filter((r) => r.status === "waitlisted");

    return (
      <main className="min-h-dvh px-5 py-8 space-y-5 max-w-lg mx-auto">
        <header className="text-center">
          <h1 className="text-2xl font-extrabold">🏀 {game.title}</h1>
          {group?.name && <p className="text-sm text-court mt-1">🎯 {group.name}</p>}
          <p className="text-sm text-ink-dim mt-1">📅 {formatThaiDateTime(game.starts_at)}</p>
          {game.location && <p className="text-xs text-ink-faint mt-0.5">📍 {game.location}</p>}
        </header>

        <section className="bg-surface-overlay/50 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold">👥 ตัวจริง ({pConfirmed.length}/{game.max_players})</h2>
          {pConfirmed.length > 0 ? (
            <ul className="space-y-1.5">
              {pConfirmed.map((r: unknown, i: number) => {
                const p = (r as { profiles: { nickname: string } | null }).profiles;
                return (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-right text-ink-faint tabular-nums">{i + 1}.</span>
                    <span>{p?.nickname ?? "ผู้เล่น"}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink-faint text-center py-2">ยังไม่มีผู้ลงชื่อ</p>
          )}

          {pTentative.length > 0 && (
            <div className="border-t border-white/5 pt-3">
              <p className="text-sm font-semibold text-blue-400">🤷 ไม่แน่นอน ({pTentative.length})</p>
              <ul className="mt-1 space-y-1">
                {pTentative.map((r: unknown, i: number) => (
                  <li key={i} className="text-sm text-ink-dim">
                    {(r as { profiles: { nickname: string } | null }).profiles?.nickname ?? "ผู้เล่น"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pWaitlist.length > 0 && (
            <div className="border-t border-white/5 pt-3">
              <p className="text-sm font-semibold text-amber-400">⏳ สำรอง ({pWaitlist.length})</p>
              <ul className="mt-1 space-y-1">
                {pWaitlist.map((r: unknown, i: number) => (
                  <li key={i} className="text-sm text-ink-dim">
                    {(r as { profiles: { nickname: string } | null }).profiles?.nickname ?? "ผู้เล่น"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="text-center space-y-3">
          <p className="text-xs text-ink-faint">ต้องการลงชื่อหรือดูรายละเอียดเพิ่มเติม?</p>
          <Link href="/login" className="inline-flex h-10 items-center justify-center rounded-xl bg-court px-6 text-sm font-semibold text-white hover:bg-court-dark transition">
            เข้าสู่ระบบด้วย LINE
          </Link>
        </div>
      </main>
    );
  }

  // ดึงรายชื่อแบบเต็ม (มีข้อมูลผู้ชวน) — ถ้าคอลัมน์ใหม่ยังไม่ถูกสร้าง
  // (ยังไม่ได้รัน migration 010) ให้ถอยไปดึงแบบพื้นฐาน เพื่อให้รายชื่อโชว์ได้เสมอ
  let regsData: unknown[] = [];
  const full = await supabase
    .from("registrations")
    .select(
      "id, profile_id, status, registered_at, ref_profile_id, ref_approved, note, profiles!profile_id(nickname, avatar_url, is_guest), ref:profiles!ref_profile_id(nickname)"
    )
    .eq("game_id", gameId)
    .in("status", ["confirmed", "waitlisted", "tentative"])
    .order("registered_at", { ascending: true });
  if (full.error) {
    const basic = await supabase
      .from("registrations")
      .select("id, profile_id, status, registered_at, profiles!profile_id(nickname, avatar_url)")
      .eq("game_id", gameId)
      .in("status", ["confirmed", "waitlisted", "tentative"])
      .order("registered_at", { ascending: true });
    regsData = ((basic.data ?? []) as Record<string, unknown>[]).map((r) => ({
      ...r,
      profiles: r.profiles
        ? { ...(r.profiles as object), is_guest: false }
        : null,
      ref_profile_id: null,
      ref_approved: false,
      note: null,
      ref: null,
    }));
  } else {
    regsData = full.data ?? [];
  }

  // แอดมิน "ตัวจริง" ของ Session = แอดมินเต็มระบบ หรือ แอดมินของก๊วนที่ Session นี้สังกัด
  let isRealManager = isAdmin;
  if (!isAdmin && game.group_id) {
    const { data: gm } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", game.group_id)
      .eq("profile_id", user.id)
      .maybeSingle();
    isRealManager = gm?.role === "admin";
  }
  // จัดการ Session ได้ = แอดมินตัวจริง หรือ ผู้ได้รับมอบสิทธิ์ชั่วคราวของ Session นี้
  const actingId = (game.acting_admin_id as string | null) ?? null;
  const canManage = isRealManager || actingId === user.id;

  const regs = (regsData ?? []) as unknown as RegRow[];
  const confirmed = regs.filter((r) => r.status === "confirmed");
  const tentative = regs.filter((r) => r.status === "tentative");
  const waitlist = regs.filter((r) => r.status === "waitlisted");
  // รายชื่อตัวจริงไว้ให้มอบสิทธิ์คุม Session + ชื่อผู้ได้รับมอบปัจจุบัน
  const confirmedPlayers = confirmed.map((r) => ({
    id: r.profile_id,
    nickname: r.profiles?.nickname ?? "ผู้เล่น",
  }));
  const actingName = actingId
    ? (confirmedPlayers.find((p) => p.id === actingId)?.nickname ?? "ผู้เล่น")
    : null;
  const myReg = regs.find((r) => r.profile_id === user.id);
  const myWaitlistPos =
    myReg?.status === "waitlisted"
      ? waitlist.findIndex((r) => r.profile_id === user.id) + 1
      : undefined;

  const status = game.status as GameStatus;
  const now = new Date();
  const joinOpen = status === "open" && now <= new Date(game.starts_at);
  const cancelAllowed = now <= new Date(game.reg_deadline);
  const isFull = confirmed.length >= game.max_players;
  const isFixedFee = game.fee_mode === "fixed";
  const feePerPlayer = isFixedFee
    ? game.court_fee_thb
    : confirmed.length > 0
      ? Math.ceil(game.court_fee_thb / confirmed.length)
      : null;

  const activelyPlaying = !["completed", "cancelled"].includes(status);

  let candidates: { id: string; nickname: string }[] = [];
  let members: { id: string; nickname: string }[] = [];
  if (activelyPlaying) {
    if (canManage && game.group_id) {
      const { data: gmRows } = await supabase
        .from("group_members")
        .select("profile_id")
        .eq("group_id", game.group_id);
      const groupMemberIds = new Set(
        (gmRows ?? []).map((r) => r.profile_id)
      );
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, nickname, is_guest")
        .eq("onboarded", true)
        .order("nickname");
      const filtered = (allProfiles ?? []).filter(
        (p) => !p.is_guest && groupMemberIds.has(p.id)
      );
      members = filtered.map((p) => ({ id: p.id, nickname: p.nickname }));
      const activeIds = new Set(regs.map((r) => r.profile_id));
      candidates = members.filter((p) => !activeIds.has(p.id));
    } else {
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, nickname, is_guest")
        .eq("onboarded", true)
        .order("nickname");
      members = (allProfiles ?? [])
        .filter((p) => !p.is_guest)
        .map((p) => ({ id: p.id, nickname: p.nickname }));
    }
  }

  // Stat keepers
  const { data: keeperRows } = await supabase
    .from("game_stat_keepers")
    .select("profile_id, profiles!profile_id(nickname, avatar_url)")
    .eq("game_id", gameId);
  const currentKeepers = ((keeperRows ?? []) as unknown as {
    profile_id: string;
    profiles: { nickname: string; avatar_url: string | null } | null;
  }[]).map((kr) => ({
    id: kr.profile_id,
    nickname: kr.profiles?.nickname ?? "ผู้เล่น",
    avatarUrl: kr.profiles?.avatar_url ?? null,
  }));
  const keeperCandidatePool = confirmed
    .filter((r) => r.status === "confirmed")
    .map((r) => ({
      id: r.profile_id,
      nickname: r.profiles?.nickname ?? "ผู้เล่น",
      avatarUrl: r.profiles?.avatar_url ?? null,
    }));

  const groupName =
    (game.groups as { name?: string } | null)?.name ?? null;
  const rows: [string, string][] = [
    ...(groupName ? ([["ก๊วน", groupName]] as [string, string][]) : []),
    [
      "วันเวลา",
      `${formatThaiDateTime(game.starts_at)} (${formatTimeRange(game.starts_at, game.ends_at)})`,
    ],
    ["สถานที่", game.location],
    ...(isFixedFee
      ? ([["ค่าสนาม", `${formatBaht(game.court_fee_thb)} ต่อคน (fix)`]] as [
          string,
          string,
        ][])
      : ([
          ["ค่าสนามรวม", formatBaht(game.court_fee_thb)],
          [
            "หารต่อคน",
            feePerPlayer ? `~${formatBaht(feePerPlayer)}` : "รอคนลงชื่อ",
          ],
        ] as [string, string][])),
    ...(game.game_duration_minutes
      ? ([["เวลา/เกมส์", `${game.game_duration_minutes} นาที`]] as [string, string][])
      : []),
    ...(game.players_per_team
      ? ([["รูปแบบ", `${game.players_per_team}×${game.players_per_team}`]] as [string, string][])
      : []),
    ...(game.notes
      ? ([["หมายเหตุ", game.notes]] as [string, string][])
      : []),
  ];

  return (
    <main className="px-5 py-8 space-y-5">
      <RealtimeRegistrations gameId={gameId} />

      <header className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{game.title}</h1>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
            GAME_STATUS_STYLES[status]
          )}
        >
          {GAME_STATUS_LABELS[status]}
        </span>
      </header>

      <Card>
        <dl className="divide-y divide-white/5">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between gap-4 py-2.5 text-sm"
            >
              <dt className="text-ink-dim shrink-0">{label}</dt>
              <dd className="font-medium text-right">{value}</dd>
            </div>
          ))}
        </dl>
        {game.notes && (
          <p className="mt-3 rounded-xl bg-surface-overlay px-4 py-3 text-sm text-ink-dim">
            📝 {game.notes}
          </p>
        )}
      </Card>

      {status !== "draft" && (
        <div className="grid grid-cols-2 gap-3">
          {game.court_fee_thb > 0 && (
            <Link
              href={`/games/${gameId}/payments`}
              className="flex h-12 items-center justify-center gap-2 rounded-xl2 bg-surface-raised border border-white/5 font-semibold text-sm hover:border-court/40 transition"
            >
              💰 จ่ายเงิน
            </Link>
          )}
          <Link
            href={`/games/${gameId}/teams`}
            className="flex h-12 items-center justify-center gap-2 rounded-xl2 bg-surface-raised border border-white/5 font-semibold text-sm hover:border-court/40 transition"
          >
            ⚖️ จัดทีม
          </Link>
          <Link
            href={`/games/${gameId}/stats`}
            className="flex h-12 items-center justify-center gap-2 rounded-xl2 bg-surface-raised border border-white/5 font-semibold text-sm hover:border-court/40 transition"
          >
            📊 สถิติ
          </Link>
          {status === "completed" ? (
            <Link
              href={`/games/${gameId}/my-stats`}
              className="flex h-12 items-center justify-center gap-2 rounded-xl2 bg-court font-semibold text-sm text-white"
            >
              📊 สถิติของฉัน
            </Link>
          ) : (
            <Link
              href={`/games/${gameId}/live`}
              className="flex h-12 items-center justify-center gap-2 rounded-xl2 bg-surface-raised border border-white/5 font-semibold text-sm hover:border-court/40 transition"
            >
              🔴 จดสกอร์สด
            </Link>
          )}
          <Link
            href={`/games/${gameId}/videos`}
            className="flex h-12 items-center justify-center gap-2 rounded-xl2 bg-surface-raised border border-white/5 font-semibold text-sm hover:border-court/40 transition"
          >
            🎬 วิดีโอ
          </Link>
          <Link
            href={`/games/${gameId}/photos`}
            className="flex h-12 items-center justify-center gap-2 rounded-xl2 bg-surface-raised border border-white/5 font-semibold text-sm hover:border-court/40 transition"
          >
            📷 รูปภาพ
          </Link>
        </div>
      )}

      {status === "completed" && (
        <CompletedSessionSummary
          gameId={gameId}
          gameTitle={game.title as string}
          gameLocation={game.location as string}
          gameDate={game.starts_at as string}
        />
      )}

      {canManage && confirmed.length > 0 && ["open", "closed"].includes(status) && (
        <form action={startMatchSession.bind(null, gameId)}>
          <button
            type="submit"
            className="w-full flex h-14 items-center justify-center gap-3 rounded-xl2 bg-court font-bold text-base text-white shadow-lg shadow-court/30 hover:bg-court-dark transition active:scale-[0.98]"
          >
            🏀 เริ่มต้นแข่งขัน
          </button>
        </form>
      )}

      {activelyPlaying && (
        <JoinControls
          gameId={gameId}
          myStatus={myReg?.status ?? null}
          waitlistPosition={myWaitlistPos}
          isFull={isFull}
          joinOpen={joinOpen}
          cancelAllowed={cancelAllowed}
        />
      )}

      {activelyPlaying && joinOpen && (
        <GuestAddForm gameId={gameId} members={members} meId={user.id} />
      )}

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>
            ตัวจริง ({confirmed.length}/{game.max_players})
          </CardTitle>
        </div>
        <div className="mt-2 h-2 rounded-full bg-surface-overlay overflow-hidden">
          <div
            className="h-full bg-court transition-all"
            style={{
              width: `${Math.min(100, (confirmed.length / game.max_players) * 100)}%`,
            }}
          />
        </div>
        {confirmed.length > 0 ? (
          <ol className="mt-3 divide-y divide-white/5">
            {confirmed.map((reg, i) => (
              <PlayerRow
                key={reg.id}
                index={i + 1}
                reg={reg}
                gameId={gameId}
                isAdmin={canManage && activelyPlaying}
                highlight={reg.profile_id === user.id}
                meId={user.id}
              />
            ))}
          </ol>
        ) : (
          <p className="mt-3 py-6 text-center text-sm text-ink-faint">
            ยังไม่มีใครลงชื่อ — เป็นคนแรกเลย!
          </p>
        )}
      </Card>

      {tentative.length > 0 && (
        <Card>
          <CardTitle>ไม่แน่นอน ({tentative.length})</CardTitle>
          <ol className="mt-2 divide-y divide-white/5">
            {tentative.map((reg, i) => (
              <PlayerRow
                key={reg.id}
                index={i + 1}
                reg={reg}
                gameId={gameId}
                isAdmin={canManage && activelyPlaying}
                highlight={reg.profile_id === user.id}
                meId={user.id}
              />
            ))}
          </ol>
        </Card>
      )}

      {waitlist.length > 0 && (
        <Card>
          <CardTitle>คิวสำรอง ({waitlist.length})</CardTitle>
          <ol className="mt-2 divide-y divide-white/5">
            {waitlist.map((reg, i) => (
              <PlayerRow
                key={reg.id}
                index={i + 1}
                reg={reg}
                gameId={gameId}
                isAdmin={canManage && activelyPlaying}
                highlight={reg.profile_id === user.id}
                meId={user.id}
              />
            ))}
          </ol>
        </Card>
      )}

      {canManage && (
        <Card>
          <CardTitle>จัดการ Session (แอดมิน)</CardTitle>
          {activelyPlaying && (
            <AdminAddForm gameId={gameId} candidates={candidates} />
          )}
          {isRealManager && activelyPlaying && (
            <DelegateAdminControl
              gameId={gameId}
              actingId={actingId}
              actingName={actingName}
              candidates={confirmedPlayers.filter((p) => p.id !== actingId)}
            />
          )}
          {activelyPlaying && (
            <details className="-mx-4 mt-3 border-t border-white/5 px-4 pt-3">
              <summary className="cursor-pointer text-xs text-ink-faint hover:text-ink transition select-none">
                📋 ผู้ช่วยจดสถิติ ({currentKeepers.length})
              </summary>
              <div className="mt-3">
                <StatKeeperManager
                  gameId={gameId}
                  currentKeepers={currentKeepers}
                  candidates={keeperCandidatePool}
                  canManage={canManage}
                />
              </div>
            </details>
          )}
          <div className="mt-3 flex flex-col gap-2">
            {STATUS_TRANSITIONS[status]?.map((next) => (
              <form key={next} action={changeGameStatus.bind(null, gameId, next)}>
                <button
                  type="submit"
                  className="w-full flex h-11 items-center justify-center rounded-xl bg-surface-overlay text-sm font-semibold hover:bg-surface-overlay/70 transition"
                >
                  {TRANSITION_LABELS[next]}
                </button>
              </form>
            ))}
            <Link
              href={`/games/${gameId}/edit`}
              className="flex h-11 items-center justify-center rounded-xl bg-surface-overlay text-sm font-semibold hover:bg-surface-overlay/70 transition"
            >
              แก้ไขรายละเอียด
            </Link>
          </div>
        </Card>
      )}

      {isAdmin && (
        <DeleteGameButton gameId={gameId} />
      )}
    </main>
  );
}
