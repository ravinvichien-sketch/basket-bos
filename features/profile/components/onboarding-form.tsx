"use client";

import { useActionState, useState } from "react";
import { completeOnboarding, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { POSITIONS, POSITION_LABELS, type Position, cn } from "@/lib/utils";

export function OnboardingForm({
  defaultNickname,
  groups,
}: {
  defaultNickname: string;
  groups: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    completeOnboarding,
    {}
  );
  const [positions, setPositions] = useState<Position[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);

  function togglePosition(p: Position) {
    setPositions((prev) =>
      prev.includes(p)
        ? prev.filter((x) => x !== p)
        : prev.length >= 3
          ? prev
          : [...prev, p]
    );
  }

  function toggleGroup(id: string) {
    setGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="nickname">ชื่อบนเสื้อ (ที่โชว์ในแอป) *</Label>
        <Input
          id="nickname"
          name="nickname"
          defaultValue={defaultNickname}
          placeholder="เช่น บอส, BOSS, 23"
          required
        />
        <p className="mt-1 text-xs text-ink-faint">
          ตั้งชื่อที่อยากให้คนอื่นเห็น เปลี่ยนได้ตลอดในหน้าตั้งค่า
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="height_cm">ส่วนสูง (ซม.) *</Label>
          <Input id="height_cm" name="height_cm" type="number" inputMode="numeric" min={100} max={250} required />
        </div>
        <div>
          <Label htmlFor="weight_kg">น้ำหนัก (กก.) *</Label>
          <Input id="weight_kg" name="weight_kg" type="number" inputMode="numeric" min={30} max={200} required />
        </div>
        <div>
          <Label htmlFor="birth_year">ปีเกิด (ค.ศ.) *</Label>
          <Input id="birth_year" name="birth_year" type="number" inputMode="numeric" placeholder="1995" required />
        </div>
      </div>

      <div>
        <Label>
          ตำแหน่งที่ถนัด * <span className="text-ink-faint">(เรียงตามความถนัด สูงสุด 3)</span>
        </Label>
        <input type="hidden" name="positions" value={JSON.stringify(positions)} />
        <div className="grid grid-cols-5 gap-2">
          {POSITIONS.map((p) => {
            const order = positions.indexOf(p);
            const selected = order >= 0;
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePosition(p)}
                title={POSITION_LABELS[p]}
                className={cn(
                  "relative h-14 rounded-xl border text-sm font-bold transition",
                  selected
                    ? "border-court bg-court/15 text-court"
                    : "border-white/10 bg-surface-overlay text-ink-dim"
                )}
              >
                {p}
                {selected && (
                  <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-court text-white text-xs flex items-center justify-center">
                    {order + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>มือที่ถนัด *</Label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["right", "ขวา"],
              ["left", "ซ้าย"],
              ["both", "สองมือ"],
            ] as const
          ).map(([value, label], i) => (
            <label
              key={value}
              className="flex h-11 items-center justify-center rounded-xl border border-white/10 bg-surface-overlay text-sm cursor-pointer has-[:checked]:border-court has-[:checked]:bg-court/15 has-[:checked]:text-court"
            >
              <input
                type="radio"
                name="dominant_hand"
                value={value}
                defaultChecked={i === 0}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label>
          ก๊วนที่เล่นอยู่ <span className="text-court">*(เลือกอย่างน้อย 1 ก๊วน)</span>
        </Label>
        <input type="hidden" name="group_ids" value={JSON.stringify(groupIds)} />
        {groups.length === 0 ? (
          <p className="text-sm text-ink-faint">ยังไม่มีก๊วนในระบบ</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => {
              const selected = groupIds.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGroup(g.id)}
                  className={cn(
                    "h-10 rounded-xl border px-3 text-sm font-semibold transition",
                    selected
                      ? "border-court bg-court/15 text-court"
                      : "border-white/10 bg-surface-overlay text-ink-dim"
                  )}
                >
                  {selected && "✓ "}
                  {g.name}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-1.5 text-xs text-ink-faint">
          ใช้แยกดูอันดับเฉพาะก๊วนของคุณ (คะแนนเริ่มที่ 50 เท่ากันทุกคน เล่นแล้วขึ้นเอง)
        </p>
      </div>

      <div>
        <Label htmlFor="bio">ประวัติการเล่นบาส (ไม่บังคับ)</Label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          placeholder="เช่น อดีตนักกีฬาโรงเรียน เล่นมา 10 ปี"
          className="w-full rounded-xl bg-surface-overlay border border-white/10 px-4 py-3 text-base placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-court"
        />
      </div>

      {state.error && (
        <p className="rounded-xl bg-red-500/10 text-red-400 text-sm px-4 py-3">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending || positions.length === 0}>
        {pending ? "กำลังบันทึก..." : "เริ่มเล่นกันเลย 🏀"}
      </Button>
    </form>
  );
}
