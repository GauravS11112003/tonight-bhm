import sitesJson from "@/data/sites.json";
import { buildAsks, type Ask } from "@/lib/asks";
import { buildAlerts, type HubAlert } from "@/lib/notify/alerts";
import { buildWeek, type Night } from "@/lib/plan";
import { birminghamNow } from "@/lib/time";
import { readStore } from "@/lib/volunteers/store.server";
import type { ForecastSource, Site } from "@/lib/types";

export const SITES = sitesJson as Site[];
// The one shelter with a demand forecast. Asks are only generated where we can predict.
export const FORECAST_SITE = SITES.find((s) => s.id === "firehouse-shelter")!;

export type Hub = { nights: Night[]; source: ForecastSource; scope: string; asks: Ask[]; alerts: HubAlert[] };

/** Server only: the week, the asks it implies, and the alert queue. Everything the hub pages share. */
export async function buildHub(scenario: boolean): Promise<Hub> {
  const { nights, source } = await buildWeek(scenario);
  const scope = scenario ? "scenario" : "live";
  const asks = buildAsks(nights, FORECAST_SITE, scope);
  const states = readStore().asks ?? {};
  const open = asks.filter((a) => (states[a.id]?.status ?? "open") === "open");
  const alerts = buildAlerts(nights, open, SITES, { date: nights[0].day.date, hour: birminghamNow().hour }, scope);
  return { nights, source, scope, asks, alerts };
}

export type TonightSite = {
  id: string; name: string; short: string; type: Site["type"]; lat: number | null; lng: number | null;
  status: "open" | "likely" | "closed"; line: string; room: string; phone: string | null; address: string | null; beds?: string;
};
const SHORT: Record<string, string> = { "firehouse-shelter": "Firehouse", "firehouse-day": "Firehouse day shelter", "jimmie-hale-warming": "Jimmie Hale warming station", "pathways-warming": "Pathways warming station" };

/** Same "open tonight?" logic as routing, reduced to a status and a line about room. */
export function tonightSites(t: Night): TonightSite[] {
  const fired = (id: string) => t.results.find((r) => r.ruleId === id);
  const weekday = new Date(t.day.date + "T12:00:00Z").getUTCDay();
  // A confidential-location site (for example a domestic-violence shelter) is never listed or mapped.
  return SITES.filter((s) => s.type !== "pathway" && !s.confidentialLocation).map((s) => {
    let status: TonightSite["status"] = "closed";
    let line = s.notes;
    let room = "room unverified — call";
    if (s.opens === "nightly") status = "open";
    else if (s.opens.startsWith("rule:")) {
      const r = fired(s.opens.slice(5));
      status = r?.fired ? "likely" : "closed";
      line = r?.fired ? `${r.reason} The city announces each opening; confirm first.` : `Opens only on city-announced freezing nights. ${r?.reason ?? ""}`;
      room = r?.fired ? "likely active (assumption) · room unverified — call" : "not active tonight";
    } else if (s.opens.startsWith("schedule-or-rule:")) {
      const r = fired(s.opens.slice(17));
      const today = s.schedule?.days.includes(weekday) || r?.fired;
      status = today ? "open" : "closed";
      line = today ? `Open today ${s.schedule?.hours}. Daytime only.` : "Not a day-shelter day today.";
      room = today ? `open ${s.schedule?.hours}, daytime only` : "not a day-shelter day";
    }
    let beds: string | undefined;
    if (s.id === FORECAST_SITE.id && s.capacity !== null) {
      const spare = Math.max(0, Math.round(s.capacity - t.prediction.raw));
      const over = Math.round(t.prediction.spill);
      beds = `${Math.round(t.prediction.predicted)}/${s.capacity}`;
      room = over >= 1 ? `predicted full, about ${over} over` : `about ${spare} of ${s.capacity} beds free`;
    }
    return { id: s.id, name: s.name, short: SHORT[s.id] ?? s.name, type: s.type, lat: s.lat, lng: s.lng, status, line, room, phone: s.phone, address: s.address, beds };
  });
}
