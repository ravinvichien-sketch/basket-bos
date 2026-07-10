import QRCode from "qrcode";
import Image from "next/image";

const APP_URL = "https://basket-bos.vercel.app";

export default async function QRPage() {
  const qrSvg = await QRCode.toString(APP_URL, {
    type: "svg",
    margin: 2,
    color: { dark: "#000", light: "#fff" },
  });

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-white">
      <div className="w-full max-w-xs text-center space-y-5">
        <Image
          src="/logo.png"
          alt="Basket Bos"
          width={80}
          height={80}
          className="mx-auto rounded-2xl"
        />
        <h1 className="text-2xl font-extrabold text-gray-900">
          BAS BOS
        </h1>
        <div
          className="mx-auto w-64 h-64"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="text-sm text-gray-500">
          สแกนเพื่อเข้าใช้งาน BAS BOS
        </p>
      </div>
    </main>
  );
}
