import type { Metadata, Viewport } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";

const dm = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-dm" });
// One display face, used only for page titles and the largest figures.
const display = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-display" });

export const metadata: Metadata = {
  title: "Tonight BHM",
  description: "See Birmingham's shelter demand coming and route people before the beds run out.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f5f8fb" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dm.variable} ${display.variable}`}>
      <body className="min-h-screen bg-ground text-ink">{children}</body>
    </html>
  );
}
