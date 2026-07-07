import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl mb-4">🏀💨</p>
      <h1 className="text-xl font-bold">แอร์บอล — ไม่พบหน้านี้</h1>
      <p className="mt-2 text-sm text-ink-dim">
        หน้าที่คุณหาอาจถูกลบหรือย้ายไปแล้ว
      </p>
      <Link
        href="/dashboard"
        className="mt-6 flex h-11 items-center rounded-xl bg-court px-6 text-sm font-semibold text-white hover:bg-court-dark transition"
      >
        กลับหน้าแรก
      </Link>
    </main>
  );
}
