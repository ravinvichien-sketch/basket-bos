import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/features/auth/guards";
import { PhotoUpload } from "./photo-upload";
import { Card, CardTitle } from "@/components/ui/card";

interface GamePhotoRow {
  id: string;
  storage_path: string;
  drive_url: string | null;
  caption: string | null;
  uploaded_by: string;
  created_at: string;
}

export default async function GamePhotosPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const { supabase, user } = await getAdminContext();

  const { data: game } = await supabase
    .from("games")
    .select("id, title")
    .eq("id", gameId)
    .single();
  if (!game) notFound();

  const { data: photos } = await supabase
    .from("game_photos")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false });

  const storage = (await createClient()).storage.from("game_photos");

  return (
    <main className="px-5 py-8 space-y-5">
      <header>
        <Link href={`/games/${gameId}`} className="text-xs text-ink-faint">
          ← กลับหน้า Session
        </Link>
        <h1 className="text-2xl font-extrabold mt-1">📷 รูปภาพ</h1>
        <p className="text-sm text-ink-dim">{game.title}</p>
      </header>

      <PhotoUpload gameId={gameId} />

      {photos && photos.length > 0 ? (
        <>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(photos as GamePhotoRow[])
            .filter((p) => p.storage_path)
            .map((photo) => {
            const { data: { publicUrl } } = storage.getPublicUrl(photo.storage_path);
            return (
              <div key={photo.id} className="relative group">
                <div className="aspect-square rounded-xl overflow-hidden bg-surface-overlay">
                  <Image
                    src={publicUrl}
                    alt={photo.caption ?? ""}
                    width={400}
                    height={400}
                    className="h-full w-full object-cover"
                  />
                </div>
                {photo.caption && (
                  <p className="mt-1 text-xs text-ink-dim truncate px-1">
                    {photo.caption}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Google Drive links */}
        {(photos as GamePhotoRow[]).filter((p) => p.drive_url).length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-ink-dim">🔗 ลิงก์ Google Drive</h2>
            <ul className="space-y-1.5">
              {(photos as GamePhotoRow[])
                .filter((p) => p.drive_url)
                .map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.drive_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl bg-surface-overlay px-4 py-2.5 text-sm text-court hover:bg-surface-highlight transition"
                    >
                      <span className="truncate">{item.drive_url!}</span>
                      <span className="shrink-0 text-xs text-ink-faint">↗</span>
                    </a>
                  </li>
                ))}
            </ul>
          </section>
        )}
        </>
      ) : (
        <Card className="py-12 text-center text-sm text-ink-faint">
          ยังไม่มีรูปภาพ — อัปโหลดรูปแรกเลย!
        </Card>
      )}

      {photos && photos.length > 0 && (
        <p className="text-center text-xs text-ink-faint">
          📤 แตะรูปค้างเพื่อแชร์ หรือบันทึก
        </p>
      )}
    </main>
  );
}
