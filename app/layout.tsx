import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Basket Bos",
  description: "จองคิว จัดทีม จ่ายค่าสนาม และเก็บสถิติแบบ NBA สำหรับก๊วนบาสของคุณ",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Basket Bos",
    description: "จองคิว จัดทีม จ่ายค่าสนาม และเก็บสถิติแบบ NBA สำหรับก๊วนบาสของคุณ",
    images: ["/logo.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F6E635",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className="dark">
      <body>
        {/* ฟอนต์ไทยโมเดิร์นไม่มีหัว (Kanit) + ตัวเลขสกอร์บอร์ด (Oswald) — React hoists to <head> */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700;800&family=Oswald:wght@500;600;700&display=swap"
        />
        {children}
      </body>
    </html>
  );
}
