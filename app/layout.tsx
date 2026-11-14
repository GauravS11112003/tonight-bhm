import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dm = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-dm" });

export const metadata: Metadata = {
  title: "Tonight BHM",
  description: "See Birmingham's shelter demand coming and route people before the beds run out.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f5f8fb" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dm.variable}>
      <body className="min-h-screen bg-ground text-ink">{children}</body>
    </html>
  );
}
