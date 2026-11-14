import sitesJson from "@/data/sites.json";
import CityMap, { type MapSite } from "@/components/CityMap";
import { buildWeek } from "@/lib/plan";
import { toBrief } from "@/lib/volunteers/nights";
import type { Site } from "@/lib/types";

// The landing page: all of Birmingham in 3D, with tonight's forecast, every site's
// status and volunteers' area reports on one map.
export const dynamic = "force-dynamic";

const SHORT: Record<string, string> = { "firehouse-shelter": "Firehouse", "firehouse-day": "Firehouse day shelter", "jimmie-hale-warming": "Jimmie Hale warming station" };

export default async function Home({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const scenario = (await searchParams).scenario === "arctic";
  const { nights } = await buildWeek(scenario);
  const t = nights[0];
  const fired = (id: string) => t.results.find((r) => r.ruleId === id);
  const weekday = new Date(t.day.date + "T12:00:00Z").getUTCDay();

  // Same "open tonight?" logic as routing, reduced to a status for the map.
  const sites: MapSite[] = (sitesJson as Site[]).filter((s) => s.type !== "pathway").map((s) => {
    let status: MapSite["status"] = "closed";
    let line = s.notes;
    if (s.opens === "nightly") { status = "open"; }
    else if (s.opens.startsWith("rule:")) {
      const r = fired(s.opens.slice(5));
      status = r?.fired ? "likely" : "closed";
      line = r?.fired ? `${r.reason} The city announces each opening; confirm first.` : `Opens only on city-announced freezing nights. ${r?.reason ?? ""}`;
    } else if (s.opens.startsWith("schedule-or-rule:")) {
      const r = fired(s.opens.slice(17));
      const today = s.schedule?.days.includes(weekday) || r?.fired;
      status = today ? "open" : "closed";
      line = today ? `Open today ${s.schedule?.hours}. Daytime only.` : "Not a day-shelter day today.";
    }
    return {
      id: s.id, name: s.name, short: SHORT[s.id] ?? s.name, lat: s.lat, lng: s.lng, status, line, phone: s.phone, address: s.address,
      beds: s.id === "firehouse-shelter" ? `${Math.round(t.prediction.predicted)}/100` : undefined,
    };
  });

  return <CityMap tonight={toBrief(t, 0)} week={nights.map(toBrief)} sites={sites} scenario={scenario} />;
}
