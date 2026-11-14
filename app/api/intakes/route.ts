import { NextResponse } from "next/server";
import { z } from "zod";
import sitesJson from "@/data/sites.json";
import { NEEDS } from "@/lib/intake/schema";
import { readEvents, writeEvents } from "@/lib/insights/store.server";
import { birminghamNow } from "@/lib/time";

export const dynamic = "force-dynamic";

const SITE_IDS = (sitesJson as { id: string }[]).map((s) => s.id);
// The whole body. Anything else a client sends (a note, an age, a device id) is dropped by Zod.
const Body = z.object({ needs: z.array(z.enum(NEEDS)).max(6), topSite: z.string().nullable() });

/** Only a count leaves the server. Individual events are never listed. */
export function GET() {
  const today = birminghamNow().date;
  return NextResponse.json({ routedToday: readEvents().filter((e) => e.date === today).length });
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });
  const today = birminghamNow().date;
  const topSite = parsed.data.topSite && SITE_IDS.includes(parsed.data.topSite) ? parsed.data.topSite : null;
  const events = [...readEvents(), { date: today, needs: [...new Set(parsed.data.needs)], topSite }];
  writeEvents(events);
  return NextResponse.json({ routedToday: events.filter((e) => e.date === today).length });
}

/** Demo reset: forget recorded intake events. */
export function DELETE() {
  writeEvents([]);
  return NextResponse.json({ routedToday: 0 });
}
