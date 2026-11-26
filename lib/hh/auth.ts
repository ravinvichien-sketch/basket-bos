import "server-only";
import { timingSafeEqual } from "crypto";

/** Checks `Authorization: Bearer <HH_API_TOKEN>` for calls from the Hoop Highlights desktop app. */
export function checkHhToken(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  // A value pasted into a settings box often carries a stray newline or space, so compare trimmed.
  const expected = (process.env.HH_API_TOKEN ?? "").trim();
  if (!expected) return { ok: false, status: 503, error: "HH_API_TOKEN not configured" };
  const header = req.headers.get("authorization") ?? "";
  const given = (header.startsWith("Bearer ") ? header.slice(7) : "").trim();
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    // The lengths alone say whether the two sides hold different values; they reveal nothing usable.
    return { ok: false, status: 401, error: `Unauthorized (token ที่ส่งมายาว ${a.length} ตัว, ที่ตั้งไว้ใน Vercel ยาว ${b.length} ตัว)` };
  }
  return { ok: true };
}
