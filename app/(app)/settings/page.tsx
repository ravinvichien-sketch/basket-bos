import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { JerseyNameForm } from "@/features/settings/components/jersey-name-form";
import { LanguageToggle } from "@/features/settings/components/language-toggle";
import { Card, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const lang = await getLang();
  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .single();

  return (
    <main className="px-5 py-8 space-y-5">
      <header>
        <Link href="/profile" className="text-xs text-ink-faint">
          ← {t(lang, "common.back")}
        </Link>
        <h1 className="text-2xl font-extrabold mt-1">⚙️ {t(lang, "settings.title")}</h1>
      </header>

      <Card>
        <JerseyNameForm lang={lang} current={profile?.nickname ?? ""} />
      </Card>

      <Card>
        <LanguageToggle current={lang} />
      </Card>
    </main>
  );
}
