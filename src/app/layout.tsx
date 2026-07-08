import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "START Munich Newsletter Generator",
  description: "Generate and manage the monthly START Munich community newsletter",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#0a0a14] text-[#f1f1f5]">{children}</body>
    </html>
  );
}
