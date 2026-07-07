"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl mb-4">😵</p>
      <h1 className="text-xl font-bold">มีบางอย่างผิดพลาด</h1>
      <p className="mt-2 text-sm text-ink-dim">
        ลองใหม่อีกครั้ง ถ้ายังไม่หายแจ้งแอดมินก๊วนได้เลย
      </p>
      <button
        onClick={reset}
        className="mt-6 h-11 rounded-xl bg-court px-6 text-sm font-semibold text-white hover:bg-court-dark transition"
      >
        ลองใหม่
      </button>
    </main>
  );
}
