import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getCollectorAdminContext } from "@/features/auth/guards";
import { buildPromptPayPayload } from "@/features/payments/lib/promptpay";
import {
  confirmPayment,
  remindUnpaid,
  revertPayment,
  waivePayment,
} from "@/features/payments/actions";
import { NotifyPaidForm } from "@/features/payments/components/notify-paid-form";
import { CreateRequestsButton } from "@/features/payments/components/create-requests-button";
import { RecalculateButton } from "@/features/payments/components/recalculate-button";
import { RealtimePayments } from "@/features/payments/components/realtime-payments";
import { CollectorSelect } from "@/features/payments/components/collector-select";
import { PayoutForm } from "@/features/payments/components/payout-form";
import { PayActions } from "@/features/payments/components/pay-actions";
import { Card, CardTitle } from "@/components/ui/card";
import { formatBaht } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PayStatus } from "@/types/database";

const PAY_LABELS: Record<PayStatus, string> = {
  unpaid: "ยังไม่จ่าย",
  pending: "แจ้งโอนแล้ว",
  paid: "จ่ายแล้ว",
  waived: "ยกเว้น",
};

const PAY_STYLES: Record<PayStatus, string> = {
  unpaid: "bg-red-500/15 text-red-400",
  pending: "bg-amber-500/15 text-amber-400",
  paid: "bg-emerald-500/15 text-emerald-400",
  waived: "bg-slate-500/15 text-slate-400",
};

interface PaymentRow {
  id: string;
  profile_id: string;
  amount_thb: number;
  status: PayStatus;
  slip_url: string | null;
  profiles: { nickname: string; avatar_url: string | null } | null;
}

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const { supabase, user, isAdmin, canManageCollector } =
    await getCollectorAdminContext(gameId);

  const [{ data: game }, { data: paymentsData }, { data: confirmedRegs }] =
    await Promise.all([
      supabase.from("games").select("*").eq("id", gameId).single(),
      supabase
        .from("payments")
        .select(
          "id, profile_id, amount_thb, status, slip_url, profiles!profile_id(nickname, avatar_url)"
        )
        .eq("game_id", gameId)
        .order("status"),
      supabase
        .from("registrations")
        .select("profile_id, profiles!profile_id(nickname)")
        .eq("game_id", gameId)
        .eq("status", "confirmed")
        .order("registered_at", { ascending: true }),
    ]);
  if (!game) notFound();

  const payments = (paymentsData ?? []) as unknown as PaymentRow[];
  const myPayment = payments.find((p) => p.profile_id === user.id);

  // คนเก็บเงิน + บัญชีรับเงินของเขา
  const collectorId = game.collector_profile_id as string | null;
  const iAmCollector = collectorId === user.id;
  let collector: {
    nickname: string;
    promptpay_id: string | null;
    bank_name: string | null;
    bank_account_no: string | null;
  } | null = null;
  if (collectorId) {
    const { data } = await supabase
      .from("profiles")
      .select("nickname, promptpay_id, bank_name, bank_account_no")
      .eq("id", collectorId)
      .single();
    collector = data ?? null;
  }
  // รายชื่อตัวจริงไว้ให้แอดมินเลือกคนเก็บเงิน
  const confirmedPlayers = (confirmedRegs ?? []).map((r) => ({
    id: r.profile_id,
    nickname:
      (r.profiles as { nickname?: string } | null)?.nickname ?? "ผู้เล่น",
  }));
  // ปลายทางรับเงิน: ต้องมีคนเก็บเงินที่ใส่ PromptPay ไว้เท่านั้น
  const payoutTarget = collector?.promptpay_id ?? null;
  // ผู้จัดการเรื่องเงิน = แอดมิน หรือ คนเก็บเงินที่ถูกแต่งตั้ง
  const canManage = isAdmin || iAmCollector;

  const paidCount = payments.filter(
    (p) => p.status === "paid" || p.status === "waived"
  ).length;
  const collected = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount_thb, 0);
  const total = payments
    .filter((p) => p.status !== "waived")
    .reduce((sum, p) => sum + p.amount_thb, 0);

  // QR for the current player (only while there is something to pay)
  let qrDataUrl: string | null = null;
  let promptPayMissing = false;
  if (myPayment && (myPayment.status === "unpaid" || myPayment.status === "pending")) {
    if (payoutTarget) {
      const payload = buildPromptPayPayload(payoutTarget, myPayment.amount_thb);
      qrDataUrl = await QRCode.toDataURL(payload, {
        type: "image/png",
        margin: 1,
        width: 512,
        color: { dark: "#0B0F14", light: "#FFFFFF" },
      });
    } else {
      promptPayMissing = true;
    }
  }

  // Signed URLs so admin/คนเก็บเงิน can view slips
  const slipUrls = new Map<string, string>();
  if (canManage) {
    for (const p of payments) {
      if (p.slip_url) {
        const { data } = await supabase.storage
          .from("slips")
          .createSignedUrl(p.slip_url, 3600);
        if (data?.signedUrl) slipUrls.set(p.id, data.signedUrl);
      }
    }
  }

  const confirmedCount = confirmedRegs?.length ?? 0;
  const isFixedFee = game.fee_mode === "fixed";
  const perPlayer = isFixedFee
    ? game.court_fee_thb
    : confirmedCount > 0
      ? Math.ceil(game.court_fee_thb / confirmedCount)
      : 0;

  return (
    <main className="px-5 py-8 space-y-5">
      <RealtimePayments gameId={gameId} />

      <header>
        <Link href={`/games/${gameId}`} className="text-xs text-ink-faint">
          ← กลับหน้า Session
        </Link>
        <h1 className="text-2xl font-extrabold mt-1">ค่าสนาม 💰</h1>
        <p className="text-sm text-ink-dim">{game.title}</p>
      </header>

      {/* คนเก็บเงิน */}
      {(canManageCollector || collector) && (
        <Card>
          <CardTitle>คนเก็บเงิน</CardTitle>
          {collector ? (
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{collector.nickname}</p>
                {collector.promptpay_id || collector.bank_account_no ? (
                  <p className="text-xs text-ink-faint">
                    {collector.promptpay_id
                      ? `PromptPay ${collector.promptpay_id}`
                      : ""}
                    {collector.promptpay_id && collector.bank_account_no
                      ? " · "
                      : ""}
                    {collector.bank_account_no
                      ? `${collector.bank_name ?? "บัญชี"} ${collector.bank_account_no}`
                      : ""}
                  </p>
                ) : (
                  <p className="text-xs text-amber-400">ยังไม่ได้ใส่บัญชีรับเงิน</p>
                )}
              </div>
              <span className="text-2xl">🧾</span>
            </div>
          ) : (
            <p className="mt-1 text-sm text-ink-faint">
              ยังไม่ได้แต่งตั้งคนเก็บเงิน — เงินจะเข้าบัญชีกลางของก๊วน
            </p>
          )}

          {canManageCollector && (
            <div className="mt-3">
              <CollectorSelect
                gameId={gameId}
                current={collectorId}
                players={confirmedPlayers}
              />
            </div>
          )}

          {iAmCollector && (
            <div className="mt-3 rounded-xl bg-surface-overlay p-3">
              <p className="mb-2 text-xs text-ink-dim">
                ใส่บัญชีรับเงินของคุณ เพื่อให้เพื่อน ๆ โอนเข้าได้เลย
              </p>
              <PayoutForm
                gameId={gameId}
                promptpay={collector?.promptpay_id ?? null}
                bankName={collector?.bank_name ?? null}
                bankNo={collector?.bank_account_no ?? null}
              />
            </div>
          )}
        </Card>
      )}

      {payments.length > 0 && (
        <Card>
          <div className="flex items-end justify-between">
            <div>
              <CardTitle>เก็บแล้ว</CardTitle>
              <p className="font-display text-3xl font-bold tabular-nums mt-1">
                {formatBaht(collected)}
                <span className="text-sm font-normal text-ink-faint">
                  {" "}
                  / {formatBaht(total)}
                </span>
              </p>
            </div>
            <p className="text-sm text-ink-dim">
              {paidCount}/{payments.length} คน
            </p>
          </div>
          <div className="mt-2 h-2 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{
                width: `${total > 0 ? Math.min(100, (collected / total) * 100) : 0}%`,
              }}
            />
          </div>
          {canManage &&
            payments.some((p) => p.status === "unpaid") && (
              <form action={remindUnpaid.bind(null, gameId)} className="mt-3">
                <button className="w-full h-10 rounded-xl bg-surface-overlay text-sm font-semibold hover:bg-surface-overlay/70 transition">
                  📣 เตือนคนที่ยังไม่จ่ายผ่าน LINE
                </button>
              </form>
            )}
          {canManage && payments.length > 0 && (
            <RecalculateButton gameId={gameId} />
          )}
        </Card>
      )}

      {payments.length === 0 && (
        <Card className="text-center py-8">
          {canManage ? (
            game.court_fee_thb > 0 && confirmedCount > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-ink-dim">
                  {isFixedFee
                    ? `เก็บต่อหัว ${formatBaht(game.court_fee_thb)} × ${confirmedCount} คน`
                    : `ค่าสนาม ${formatBaht(game.court_fee_thb)} ÷ ${confirmedCount} คน`}
                </p>
                <CreateRequestsButton
                  gameId={gameId}
                  perPlayer={perPlayer}
                  playerCount={confirmedCount}
                />
              </div>
            ) : (
              <p className="text-sm text-ink-faint">
                ต้องมีค่าสนามและผู้เล่นตัวจริงก่อนจึงเปิดเก็บเงินได้
              </p>
            )
          ) : (
            <p className="text-sm text-ink-faint">
              แอดมินยังไม่เปิดเก็บเงินสำหรับเกมนี้
            </p>
          )}
        </Card>
      )}

      {myPayment && (
        <Card>
          <CardTitle>ยอดของคุณ</CardTitle>
          <div className="mt-2 flex items-center justify-between">
            <p className="font-display text-4xl font-bold tabular-nums">
              {formatBaht(myPayment.amount_thb)}
            </p>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                PAY_STYLES[myPayment.status]
              )}
            >
              {PAY_LABELS[myPayment.status]}
            </span>
          </div>

          {myPayment.status === "paid" && (
            <p className="mt-3 text-sm text-emerald-400">
              ✓ ยอดนี้ได้รับการยืนยันแล้ว ขอบคุณครับ
            </p>
          )}

          {qrDataUrl && (
            <div className="mt-4 space-y-4">
              {collector && (
                <p className="text-center text-xs text-ink-dim">
                  โอนให้ <span className="font-semibold">{collector.nickname}</span> (คนเก็บเงิน)
                </p>
              )}
              <div className="mx-auto w-fit rounded-xl bg-white p-3">
                <img src={qrDataUrl} alt="PromptPay QR" className="w-56 h-56" />
              </div>
              <p className="text-center text-xs text-ink-faint">
                สแกนด้วยแอปธนาคาร — ยอด {formatBaht(myPayment.amount_thb)}{" "}
                ถูกใส่ให้อัตโนมัติ
              </p>
              <PayActions
                promptpayId={payoutTarget}
                bankName={collector?.bank_name ?? null}
                bankNo={collector?.bank_account_no ?? null}
                amount={myPayment.amount_thb}
                qrDataUrl={qrDataUrl}
                payeeName={collector?.nickname ?? "คนเก็บเงิน"}
              />
              {myPayment.status === "unpaid" && (
                <NotifyPaidForm paymentId={myPayment.id} gameId={gameId} />
              )}
              {myPayment.status === "pending" && (
                <p className="rounded-xl bg-amber-500/10 text-amber-400 text-sm px-4 py-3 text-center">
                  แจ้งโอนแล้ว — รอคนเก็บเงินยืนยัน
                </p>
              )}
            </div>
          )}

          {promptPayMissing && (
            <p className="mt-3 rounded-xl bg-amber-500/10 text-amber-400 text-sm px-4 py-3">
              ⚠️ ยังไม่มีบัญชีรับเงิน — คนเก็บเงินยังไม่ได้ใส่ PromptPay
              (หรือแอดมินยังไม่ได้แต่งตั้งคนเก็บเงิน) จึงสร้าง QR ไม่ได้
            </p>
          )}
        </Card>
      )}

      {payments.length > 0 && (
        <Card>
          <CardTitle>สถานะทั้งก๊วน</CardTitle>
          <ul className="mt-2 divide-y divide-white/5">
            {payments.map((p) => (
              <li key={p.id} className="py-2.5 space-y-2">
                <div className="flex items-center gap-3">
                  {p.profiles?.avatar_url ? (
                    <Image
                      src={p.profiles.avatar_url}
                      alt=""
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <span className="h-8 w-8 rounded-full bg-surface-overlay flex items-center justify-center text-sm">
                      🏀
                    </span>
                  )}
                  <span className="flex-1 truncate text-sm">
                    {p.profiles?.nickname ?? "ผู้เล่น"}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatBaht(p.amount_thb)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      PAY_STYLES[p.status]
                    )}
                  >
                    {PAY_LABELS[p.status]}
                  </span>
                </div>

                {canManage && (
                  <div className="flex items-center gap-2 pl-11">
                    {slipUrls.has(p.id) && (
                      <a
                        href={slipUrls.get(p.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-court underline"
                      >
                        ดูสลิป
                      </a>
                    )}
                    {(p.status === "unpaid" || p.status === "pending") && (
                      <>
                        <form action={confirmPayment.bind(null, p.id, gameId)}>
                          <button className="rounded-lg bg-emerald-500/15 text-emerald-400 px-2.5 py-1 text-xs font-semibold hover:bg-emerald-500/25 transition">
                            ยืนยันจ่ายแล้ว
                          </button>
                        </form>
                        <form action={waivePayment.bind(null, p.id, gameId)}>
                          <button className="rounded-lg bg-surface-overlay px-2.5 py-1 text-xs font-semibold hover:bg-surface-overlay/70 transition">
                            ยกเว้น
                          </button>
                        </form>
                      </>
                    )}
                    {(p.status === "paid" || p.status === "waived") && (
                      <form action={revertPayment.bind(null, p.id, gameId)}>
                        <button className="rounded-lg bg-surface-overlay px-2.5 py-1 text-xs text-ink-faint hover:text-ink transition">
                          ย้อนสถานะ
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
