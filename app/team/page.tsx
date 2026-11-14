import Link from "next/link";
import os from "node:os";
import QRCode from "qrcode";
import Nav from "@/components/Nav";
import TeamBoard from "@/components/TeamBoard";
import { buildWeek } from "@/lib/plan";
import { toBrief } from "@/lib/volunteers/nights";

export const dynamic = "force-dynamic";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const scenario = (await searchParams).scenario === "arctic";
  const { nights, source } = await buildWeek(scenario);
  // Demo: a QR code to this laptop on the local network, so phones in the room can join.
  const ip = Object.values(os.networkInterfaces()).flat().find((n) => n && n.family === "IPv4" && !n.internal)?.address ?? "localhost";
  const url = process.env.DEMO_URL ?? `http://${ip}:${process.env.PORT ?? 3001}/volunteer`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 0 });
  return (
    <>
      <Nav active="/team" scenario={scenario} source={source} />
      <main className="mx-auto max-w-[1320px] px-4 pt-6 pb-20 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="rise text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[48px]">Volunteer team</h1>
            <p className="rise mt-2 max-w-[640px] text-[17px] text-ink/85" style={{ ["--d" as string]: "80ms" }}>
              The forecast says how many hands each night needs. Volunteers sign up and send requests from their phones; both land here live.
            </p>
          </div>
          <Link href={`/volunteer${scenario ? "?scenario=arctic" : ""}`} className="press rounded-full bg-accent px-6 py-3 text-[15px] font-semibold text-white hover:bg-accent-ink">
            Open the volunteer app
          </Link>
        </div>
        <TeamBoard nights={nights.map(toBrief)} qr={qr} url={url} />
      </main>
    </>
  );
}
