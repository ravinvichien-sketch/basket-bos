import { z } from "zod";

const bangkokDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "รูปแบบวันเวลาไม่ถูกต้อง")
  .transform((v) => new Date(`${v}:00+07:00`));

export const gameSchema = z
  .object({
    group_id: z.string().uuid("กรุณาเลือกก๊วน"),
    title: z.string().trim().min(1, "กรุณาใส่ชื่อ Session").max(100, "ชื่อ Session ยาวเกินไป"),
    location: z.string().trim().min(1, "กรุณาใส่สถานที่").max(200),
    starts_at: bangkokDateTime,
    ends_at: bangkokDateTime,
    fee_mode: z.enum(["split", "fixed"]),
    court_fee_thb: z.coerce
      .number()
      .int("ค่าสนามต้องเป็นจำนวนเต็ม")
      .min(0, "ค่าสนามต้องไม่ติดลบ")
      .max(100000),
    max_players: z.coerce
      .number()
      .int()
      .min(2, "ต้องมีอย่างน้อย 2 คน")
      .max(100, "ไม่เกิน 100 คน"),
    max_waitlist: z.coerce
      .number()
      .int()
      .min(0, "สำรองต้องไม่ติดลบ")
      .max(50, "สำรองไม่เกิน 50 คน"),
    players_per_team: z.coerce
      .number()
      .int()
      .min(1, "ต้องมีอย่างน้อย 1 คนต่อทีม")
      .max(20, "ไม่เกิน 20 คนต่อทีม")
      .default(5),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
    game_duration_minutes: z.coerce
      .number()
      .int()
      .min(1, "เวลาต่อเกมส์ต้องอย่างน้อย 1 นาที")
      .max(60, "ไม่เกิน 60 นาที")
      .default(8),
    target_score: z.coerce
      .number()
      .int()
      .min(0)
      .max(500)
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine((d) => d.ends_at > d.starts_at, {
    message: "เวลาจบต้องอยู่หลังเวลาเริ่ม",
    path: ["ends_at"],
  });

export type GameInput = z.infer<typeof gameSchema>;
