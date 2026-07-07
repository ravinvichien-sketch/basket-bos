import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { Card, CardTitle } from "@/components/ui/card";
import { CardPhotoManager } from "@/features/profile/components/card-photo-manager";
import { LineIdEditor } from "@/features/profile/components/line-id-editor";
import {
  DreamTeamSection,
  type DreamTeamView,
} from "@/features/profile/components/dream-teams";

const HAND_LABELS: Record<string, Record<string, string>> = {
  th: { left: "ซ้าย", right: "ขวา", both: "สองมือ" },
  en: { left: "Left", right: "Right", both: "Both" },
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: positions }, { data: myTeams }, { data: candidateProfiles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("player_positions")
      .select("position, priority")
      .eq("profile_id", user.id)
      .order("priority"),
    supabase
      .from("dream_teams")
      .select("id, name, owner_id, profiles!owner_id(nickname)")
      .or(`owner_id.eq.${user.id}`),
    supabase
      .from("profiles")
      .select("id, nickname")
      .neq("id", user.id)
      .eq("onboarded", true)
      .order("nickname"),
  ]);

  // Dream teams
  const teamIds = (myTeams ?? []).map((t: { id: string }) => t.id);
  const { data: teamMembers } = teamIds.length > 0
    ? await supabase
        .from("dream_team_members")
        .select("id, dream_team_id, profile_id, status, profiles!profile_id(nickname)")
        .in("dream_team_id", teamIds)
    : { data: [] };

  const dtTeams: DreamTeamView[] = ((myTeams ?? []) as unknown[]).map((t) => {
    const tt = t as { id: string; name: string; owner_id: string; profiles: { nickname: string } | { nickname: string }[] | null };
    const ownerNick = Array.isArray(tt.profiles)
      ? tt.profiles[0]?.nickname ?? "ผู้เล่น"
      : tt.profiles?.nickname ?? "ผู้เล่น";
    const members: { id: string; profile_id: string; nickname: string; status: string }[] = [];
    for (const m of (teamMembers ?? []) as unknown as { id: string; dream_team_id: string; profile_id: string; status: string; profiles: { nickname: string } | null }[]) {
      if (m.dream_team_id === tt.id) {
        members.push({
          id: m.id,
          profile_id: m.profile_id,
          nickname: m.profiles?.nickname ?? "ผู้เล่น",
          status: m.status,
        });
      }
    }
    return { id: tt.id, name: tt.name, owner_id: tt.owner_id, owner_nickname: ownerNick, members };
  });

  const dtCandidates = (candidateProfiles ?? []).map((p: { id: string; nickname: string }) => ({
    id: p.id, nickname: p.nickname,
  }));

  if (!profile) redirect("/onboarding");

  const lang = await getLang();
  const rows: [string, string][] = [
    [t(lang, "profile.height"), `${profile.height_cm} ${t(lang, "profile.cm")}`],
    [t(lang, "profile.weight"), `${profile.weight_kg} ${t(lang, "profile.kg")}`],
    [t(lang, "profile.birthYear"), String(profile.birth_year ?? "–")],
    [t(lang, "profile.hand"), HAND_LABELS[lang][profile.dominant_hand] ?? "–"],
    [t(lang, "profile.positions"), positions?.map((p) => p.position).join(", ") || "–"],
  ];

  return (
    <main className="px-5 py-8 space-y-6">
      <header className="flex items-center gap-4">
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt=""
            width={64}
            height={64}
            className="rounded-full"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-surface-overlay flex items-center justify-center text-3xl">
            🏀
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">{profile.nickname}</h1>
          <p className="text-sm text-ink-dim">
            {profile.role === "admin"
              ? t(lang, "profile.admin")
              : t(lang, "profile.player")}
          </p>
        </div>
        <Link
          href="/settings"
          aria-label={t(lang, "settings.title")}
          className="h-10 w-10 shrink-0 rounded-full bg-surface-overlay flex items-center justify-center text-lg hover:bg-surface-overlay/70 transition"
        >
          ⚙️
        </Link>
      </header>

      <Link
        href={`/players/${user.id}`}
        className="flex h-12 items-center justify-center gap-2 rounded-xl2 bg-court font-semibold text-sm text-white hover:bg-court-dark transition"
      >
        🃏 {t(lang, "profile.myCard")}
      </Link>

      <Card>
        <CardTitle>{t(lang, "profile.cardPhoto")}</CardTitle>
        <div className="mt-3">
          <CardPhotoManager currentPhotoUrl={profile.card_photo_url ?? null} />
        </div>
      </Card>

      <Card>
        <CardTitle>LINE ID</CardTitle>
        <div className="mt-3">
          <LineIdEditor currentLineId={profile.line_id ?? null} />
        </div>
      </Card>

      <Card>
        <CardTitle>{t(lang, "profile.athleteInfo")}</CardTitle>
        <dl className="mt-3 divide-y divide-white/5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between py-2.5 text-sm">
              <dt className="text-ink-dim">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {profile.bio && (
        <Card>
          <CardTitle>{t(lang, "profile.bioTitle")}</CardTitle>
          <p className="mt-2 text-sm leading-relaxed">{profile.bio}</p>
        </Card>
      )}

      <Card>
        <CardTitle>🌟 Dream Team</CardTitle>
        <div className="mt-2">
          <DreamTeamSection
            teams={dtTeams}
            meId={user.id}
            candidates={dtCandidates}
          />
        </div>
      </Card>
    </main>
  );
}
