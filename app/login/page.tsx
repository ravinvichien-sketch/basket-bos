import Link from "next/link";
import Image from "next/image";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "การล็อกอินหมดอายุ กรุณาลองใหม่อีกครั้ง",
  session_failed: "สร้างเซสชันไม่สำเร็จ กรุณาลองใหม่",
  line_login_failed: "เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <Image
          src="/logo.png"
          alt="Basket Bos"
          width={176}
          height={176}
          priority
          className="mx-auto mb-6 h-44 w-44 rounded-3xl shadow-lg"
        />
        <h1 className="sr-only">Basket Bos</h1>
        <p className="mt-3 text-ink-dim leading-relaxed">
          จองคิวลงเล่น จัดทีมแฟร์ๆ จ่ายค่าสนามสแกนเดียว
          <br />
          และเก็บสถิติระดับโปรของก๊วนคุณ
        </p>

        {error && (
          <p className="mt-6 rounded-xl bg-red-500/10 text-red-400 text-sm px-4 py-3">
            {ERROR_MESSAGES[error] ?? "เกิดข้อผิดพลาด กรุณาลองใหม่"}
          </p>
        )}

        <Link
          href="/auth/login"
          className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-line font-semibold text-white hover:brightness-95 transition"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
            <path d="M12 2C6.48 2 2 5.64 2 10.13c0 4.03 3.58 7.4 8.41 8.04.33.07.77.22.89.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1.01.89.55 1.09-.46 5.87-3.46 8.01-5.92C21.66 13.5 22 11.88 22 10.13 22 5.64 17.52 2 12 2z" />
          </svg>
          เข้าสู่ระบบด้วย LINE
        </Link>

        <p className="mt-4 text-xs text-ink-faint">
          ใช้บัญชี LINE ที่มีอยู่แล้ว ไม่ต้องสมัครสมาชิกใหม่
        </p>
      </div>
    </main>
  );
}
