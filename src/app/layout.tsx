import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "maimai Challenge",
  description: "maimaiDX International DX score ranking board",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
