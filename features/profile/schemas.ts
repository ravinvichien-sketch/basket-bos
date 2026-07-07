import { z } from "zod";
import { POSITIONS } from "@/lib/utils";

const currentYear = new Date().getFullYear();

export const onboardingSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, "กรุณาใส่ชื่อเล่น")
    .max(30, "ชื่อเล่นยาวเกินไป"),
  height_cm: z.coerce
    .number()
    .int()
    .min(100, "ส่วนสูงไม่ถูกต้อง")
    .max(250, "ส่วนสูงไม่ถูกต้อง"),
  weight_kg: z.coerce
    .number()
    .int()
    .min(30, "น้ำหนักไม่ถูกต้อง")
    .max(200, "น้ำหนักไม่ถูกต้อง"),
  birth_year: z.coerce
    .number()
    .int()
    .min(currentYear - 80, "ปีเกิดไม่ถูกต้อง")
    .max(currentYear - 8, "ปีเกิดไม่ถูกต้อง"),
  dominant_hand: z.enum(["left", "right", "both"]),
  positions: z
    .array(z.enum(POSITIONS))
    .min(1, "เลือกอย่างน้อย 1 ตำแหน่ง")
    .max(3, "เลือกได้ไม่เกิน 3 ตำแหน่ง"),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
