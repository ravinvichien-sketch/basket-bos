import { z } from "zod";

/**
 * datetime-local input ("YYYY-MM-DDTHH:mm") interpreted as Asia/Bangkok.
 * Thailand has no DST, so a fixed +07:00 offset is always correct.
 */
const bangkokDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "รูปแบบวันเวลาไม่ถูกต้อง")
  .transform((v) => new Date(`${v}:00+07:00`));

export const gameSchema = z
  .object({
    group_id: z.string().uuid("กรุณาเลือกก๊วน"),
    title: z.string().trim().min(1, "กรุณาใส่ชื่อเกม").max(100, "ชื่อเกมยาวเกินไป"),
    location: z.string().trim().min(1, "กรุณาใส่สถานที่").max(200),
    starts_at: bangkokDateTime,
    ends_at: bangkokDateTime,
    reg_opens_at: bangkokDateTime,
    reg_deadline: bangkokDateTime,
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
    notes: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((d) => d.ends_at > d.starts_at, {
    message: "เวลาจบต้องอยู่หลังเวลาเริ่ม",
    path: ["ends_at"],
  })
  .refine((d) => d.reg_deadline <= d.starts_at, {
    message: "เดดไลน์รับสมัครต้องไม่เกินเวลาเริ่มเกม",
    path: ["reg_deadline"],
  })
  .refine((d) => d.reg_opens_at < d.reg_deadline, {
    message: "เวลาเปิดรับสมัครต้องอยู่ก่อนเดดไลน์",
    path: ["reg_opens_at"],
  });

export type GameInput = z.infer<typeof gameSchema>;
