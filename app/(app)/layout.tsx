import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLang } from "@/lib/i18n-server";
import { t, type I18nKey } from "@/lib/i18n";

const NAV: readonly { href: string; key: I18nKey; icon: string }[] = [
  { href: "/dashboard", key: "nav.home", icon: "🏠" },
  { href: "/games", key: "nav.games", icon: "🏀" },
  { href: "/groups", key: "nav.groups", icon: "👥" },
  { href: "/leaderboard", key: "nav.leaderboard", icon: "🏆" },
  { href: "/profile", key: "nav.profile", icon: "👤" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded")
    .eq("id", user.id)
    .single();
  if (!profile?.onboarded) redirect("/onboarding");

  const lang = await getLang();

  return (
    <div className="mx-auto max-w-md min-h-dvh pb-20">
      {children}
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-white/5 bg-surface-raised/95 backdrop-blur">
        <div className="mx-auto max-w-md grid grid-cols-5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 py-2.5 text-xs text-ink-dim hover:text-ink"
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {t(lang, item.key)}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
