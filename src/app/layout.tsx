import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "One-In-One",
  manifest: "/manifest.webmanifest",
  description: "하루에 하나, 유형별로 한 문제씩 풀고 GitHub에 기록합니다.",
};

export const viewport: Viewport = {
  themeColor: "#1A7F37",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
