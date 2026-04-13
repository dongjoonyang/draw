import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Dream - 아트 플랫폼",
  description: "그림 연습, 공유, 소통을 위한 아트 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased min-h-screen bg-gray-950 text-white">
        <Navbar />
        <main className="pt-14">
          {children}
        </main>
        <Analytics />
      </body>
    </html>
  );
}
