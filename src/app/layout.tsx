import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";

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
      <body className="antialiased min-h-screen bg-[#F8F9FA] text-[#141415]">
        <div className="flex min-h-screen">
          {/* 데스크탑 사이드바 */}
          <Sidebar />
          {/* 메인 콘텐츠 */}
          <main className="flex-1 min-w-0 pb-16 md:pb-0 md:ml-60">
            {children}
          </main>
        </div>
        {/* 모바일 하단 탭 */}
        <BottomNav />
        <Analytics />
      </body>
    </html>
  );
}
