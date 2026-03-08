import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "인체 도형화 자가학습 플랫폼",
  description: "평가가 아닌 성장의 기록 - 나만의 연습 공간",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
