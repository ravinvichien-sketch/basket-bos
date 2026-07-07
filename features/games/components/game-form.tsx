"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ActionState } from "../actions";

export interface GameFormDefaults {
  group_id?: string;
  title?: string;
  location?: string;
  starts_at?: string; // datetime-local strings (Bangkok)
  ends_at?: string;
  reg_opens_at?: string;
  reg_deadline?: string;
  fee_mode?: "split" | "fixed";
  court_fee_thb?: number;
  max_players?: number;
  max_waitlist?: number;
  notes?: string;
}

export function GameForm({
  action,
  defaults = {},
  groups,
  submitLabel,
  showPublishToggle = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaults?: GameFormDefaults;
  groups: { id: string; name: string }[];
  submitLabel: string;
  showPublishToggle?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {}
  );
  const [feeMode, setFeeMode] = useState<"split" | "fixed">(
    defaults.fee_mode ?? "split"
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="group_id">ก๊วน *</Label>
        {groups.length === 0 ? (
          <p className="rounded-xl bg-amber-500/10 text-amber-400 text-sm px-4 py-3">
            ยังไม่มีก๊วน — สร้างก๊วนก่อนที่หน้า “จัดการแอดมินก๊วน”
          </p>
        ) : (
          <select
            id="group_id"
            name="group_id"
            defaultValue={defaults.group_id ?? ""}
            required
            className="h-12 w-full rounded-xl bg-surface-overlay border border-white/10 px-4 text-base focus:outline-none focus:ring-2 focus:ring-court"
          >
            <option value="" disabled>
              เลือกก๊วนที่จะนัดเล่น...
            </option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <Label htmlFor="title">ชื่อเกม *</Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaults.title}
          placeholder="เช่น บาสพุธเย็น สนามลาดพร้าว"
          required
        />
      </div>

      <div>
        <Label htmlFor="location">สถานที่ *</Label>
        <Input
          id="location"
          name="location"
          defaultValue={defaults.location}
          placeholder="ชื่อสนาม / ลิงก์แผนที่"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="starts_at">เริ่มเล่น *</Label>
          <Input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            defaultValue={defaults.starts_at}
            required
          />
        </div>
        <div>
          <Label htmlFor="ends_at">เลิกเล่น *</Label>
          <Input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            defaultValue={defaults.ends_at}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="reg_opens_at">เปิดรับสมัคร *</Label>
          <Input
            id="reg_opens_at"
            name="reg_opens_at"
            type="datetime-local"
            defaultValue={defaults.reg_opens_at}
            required
          />
        </div>
        <div>
          <Label htmlFor="reg_deadline">ปิดรับสมัคร *</Label>
          <Input
            id="reg_deadline"
            name="reg_deadline"
            type="datetime-local"
            defaultValue={defaults.reg_deadline}
            required
          />
        </div>
      </div>

      <div>
        <Label>รูปแบบเก็บเงิน *</Label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["split", "หารตามจำนวนคน"],
              ["fixed", "เก็บต่อหัว (fix)"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={cn(
                "flex h-11 items-center justify-center rounded-xl border text-sm cursor-pointer transition",
                feeMode === value
                  ? "border-court bg-court/15 text-court font-semibold"
                  : "border-white/10 bg-surface-overlay text-ink-dim"
              )}
            >
              <input
                type="radio"
                name="fee_mode"
                value={value}
                checked={feeMode === value}
                onChange={() => setFeeMode(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-faint">
          {feeMode === "split"
            ? "ใส่ค่าสนามรวม ระบบจะหารตามจำนวนคนที่ลงชื่อจริง"
            : "ทุกคนจ่ายราคาเดียวกัน เช่น คนละ 200 ไม่ว่ามากี่คน"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="court_fee_thb">
            {feeMode === "split" ? "ค่าสนามรวม (บาท) *" : "ราคาต่อคน (บาท) *"}
          </Label>
          <Input
            id="court_fee_thb"
            name="court_fee_thb"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={defaults.court_fee_thb ?? 0}
            placeholder={feeMode === "fixed" ? "เช่น 200" : "เช่น 1500"}
            required
          />
        </div>
        <div>
          <Label htmlFor="max_players">รับกี่คน *</Label>
          <Input
            id="max_players"
            name="max_players"
            type="number"
            inputMode="numeric"
            min={2}
            max={100}
            defaultValue={defaults.max_players ?? 20}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="max_waitlist">รับสำรองกี่คน *</Label>
        <Input
          id="max_waitlist"
          name="max_waitlist"
          type="number"
          inputMode="numeric"
          min={0}
          max={50}
          defaultValue={defaults.max_waitlist ?? 5}
          required
        />
      </div>

      <div>
        <Label htmlFor="notes">โน้ตเพิ่มเติม</Label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={defaults.notes}
          placeholder="เช่น เอาเสื้อ 2 สี, มีที่จอดรถ"
          className="w-full rounded-xl bg-surface-overlay border border-white/10 px-4 py-3 text-base placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-court"
        />
      </div>

      {showPublishToggle && (
        <label className="flex items-center gap-3 rounded-xl bg-surface-overlay border border-white/10 px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            name="publish"
            value="1"
            defaultChecked
            className="h-5 w-5 accent-court"
          />
          <span className="text-sm">
            เปิดรับสมัครทันที{" "}
            <span className="text-ink-faint">(ไม่ติ๊ก = เก็บเป็นฉบับร่าง)</span>
          </span>
        </label>
      )}

      {state.error && (
        <p className="rounded-xl bg-red-500/10 text-red-400 text-sm px-4 py-3">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "กำลังบันทึก..." : submitLabel}
      </Button>
    </form>
  );
}
