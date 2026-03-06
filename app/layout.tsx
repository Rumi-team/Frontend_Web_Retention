import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Retention Dashboard",
  description: "Rumi Retention RL Admin",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white min-h-screen">{children}</body>
    </html>
  );
}
