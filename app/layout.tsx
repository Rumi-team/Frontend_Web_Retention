import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rumi — The Retention Layer for the Agent Era",
  description:
    "AI-powered retention infrastructure for modern apps. RL-optimized engagement that communicates with personal agents. One API call to activate.",
  openGraph: {
    title: "Rumi — The Retention Layer for the Agent Era",
    description:
      "AI-powered retention infrastructure for modern apps. One API call to activate.",
    siteName: "Rumi",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-white min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
