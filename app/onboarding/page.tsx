import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingForm } from "@/features/profile/components/onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: groups }] = await Promise.all([
    supabase
      .from("profiles")
      .select("nickname, avatar_url, onboarded")
      .eq("id", user.id)
      .single(),
    createAdminClient()
      .from("groups")
      .select("id, name")
      .is("deleted_at", null)
      .order("name"),
  ]);

  if (profile?.onboarded) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-md px-5 py-10 pb-16">
      <div className="flex items-center gap-4 mb-8">
        {profile?.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt=""
            width={56}
            height={56}
            className="rounded-full"
          />
        ) : (
          <div className="h-14 w-14 rounded-full bg-surface-overlay flex items-center justify-center text-2xl">
            🏀
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold">สร้างโปรไฟล์นักบาส</h1>
          <p className="text-sm text-ink-dim">
            กรอกครั้งเดียว ใช้จัดทีมและทำการ์ดสถิติของคุณ
          </p>
        </div>
      </div>

      <OnboardingForm
        defaultNickname={profile?.nickname ?? ""}
        groups={groups ?? []}
      />
    </main>
  );
}
