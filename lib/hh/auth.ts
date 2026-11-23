import "server-only";
import { timingSafeEqual } from "crypto";

/** Checks `Authorization: Bearer <HH_API_TOKEN>` for calls from the Hoop Highlights desktop app. */
export function checkHhToken(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const expected = process.env.HH_API_TOKEN;
  if (!expected) return { ok: false, status: 503, error: "HH_API_TOKEN not configured" };
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}
