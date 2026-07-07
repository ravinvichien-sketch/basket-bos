import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Lang } from "./i18n";

/** อ่านภาษาที่ผู้ใช้ปัจจุบันเลือกไว้ (default: ไทย) */
export async function getLang(): Promise<Lang> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "th";
  const { data } = await supabase
    .from("profiles")
    .select("lang")
    .eq("id", user.id)
    .single();
  return data?.lang === "en" ? "en" : "th";
}
