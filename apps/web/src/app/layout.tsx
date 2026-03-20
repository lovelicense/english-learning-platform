import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "English Learning Platform",
  description: "내 말 기반 영어훈련 앱",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
