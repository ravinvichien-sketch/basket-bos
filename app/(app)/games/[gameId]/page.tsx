import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminContext } from "@/features/auth/guards";
import { changeGameStatus } from "@/features/games/actions";
import { adminRemovePlayer } from "@/features/registration/actions";
import {
  GAME_STATUS_LABELS,
  GAME_STATUS_STYLES,
  STATUS_TRANSITIONS,
  TRANSITION_LABELS,
} from "@/features/games/constants";
import { JoinControls } from "@/features/registration/components/join-controls";
import { RealtimeRegistrations } from "@/features/registration/components/realtime-registrations";
import { AdminAddForm } from "@/features/registration/components/admin-add-form";
import { DeleteGameButton } from "@/features/games/components/delete-game-button";
import { DelegateAdminControl } from "@/features/games/components/delegate-admin-control";
import { GuestAddForm } from "@/features/registration/components/guest-add-form";
import { RefApproveButton } from "@/features/registration/components/ref-approve-button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatThaiDateTime, formatTimeRange, formatBaht } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GameStatus } from "@/types/database";

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
      <div className="flex-1 min-w-0">
        <span className="block truncate text-sm">
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
        </span>
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
  const { supabase, user, isAdmin } = await getAdminContext();

  const { data: game } = await supabase
    .from("games")
    .select("*, groups(name)")
    .eq("id", gameId)
    .single();
  if (!game) notFound();

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

  // แอดมิน "ตัวจริง" ของนัด = แอดมินเต็มระบบ หรือ แอดมินของก๊วนที่นัดนี้สังกัด
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
  // จัดการนัดได้ = แอดมินตัวจริง หรือ ผู้ได้รับมอบสิทธิ์ชั่วคราวของนัดนี้
  const actingId = (game.acting_admin_id as string | null) ?? null;
  const canManage = isRealManager || actingId === user.id;

  const regs = (regsData ?? []) as unknown as RegRow[];
  const confirmed = regs.filter((r) => r.status === "confirmed");
  const tentative = regs.filter((r) => r.status === "tentative");
  const waitlist = regs.filter((r) => r.status === "waitlisted");
  // รายชื่อตัวจริงไว้ให้มอบสิทธิ์คุมนัด + ชื่อผู้ได้รับมอบปัจจุบัน
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
  const joinOpen =
    status === "open" &&
    now >= new Date(game.reg_opens_at) &&
    now <= new Date(game.reg_deadline);
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
    ["ปิดรับสมัคร", formatThaiDateTime(game.reg_deadline)],
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
          <CardTitle>จัดการเกม (แอดมิน)</CardTitle>
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
          <div className="mt-3 grid grid-cols-2 gap-2">
            {STATUS_TRANSITIONS[status].map((next) => (
              <form
                key={next}
                action={changeGameStatus.bind(null, gameId, next)}
              >
                <button
                  type="submit"
                  className={cn(
                    "w-full h-11 rounded-xl text-sm font-semibold transition",
                    next === "cancelled"
                      ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                      : "bg-surface-overlay hover:bg-surface-overlay/70"
                  )}
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

      {canManage && (
        <DeleteGameButton gameId={gameId} />
      )}
    </main>
  );
}
