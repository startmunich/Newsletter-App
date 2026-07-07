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
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
