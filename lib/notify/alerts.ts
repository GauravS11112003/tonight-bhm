import { askText, expectedPeople, quantities, type Ask } from "@/lib/asks";
import { RULES } from "@/lib/rules/engine";
import type { ForecastDay, NightPrediction, RuleResult, Site } from "@/lib/types";

// The alert queue. Alerts come from fired activation rules and forecast spills only.
// The wording is a template; AI never writes or sends an alert.
// Audiences are organisations and volunteers. Never a person experiencing homelessness:
// the app stores no guest phone numbers, so there is nobody of that kind to notify.
export const AUDIENCES = ["shelter_staff", "warming_operators", "volunteers", "donors"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const AUDIENCE_LABEL: Record<Audience, string> = {
  shelter_staff: "Shelter staff",
  warming_operators: "Warming-station operators",
  volunteers: "Volunteers",
  donors: "Donors",
};
// How long before 6 p.m. on the night each audience hears. ASSUMPTION: confirm with partners.
export const LEAD: Record<Audience, { daysBefore: number; hour: number }> = {
  donors: { daysBefore: 2, hour: 9 },
  volunteers: { daysBefore: 1, hour: 12 },
  shelter_staff: { daysBefore: 1, hour: 18 },
  warming_operators: { daysBefore: 1, hour: 18 },
};

export type Trigger = { id: string; label: string; reason: string; kind: "policy" | "assumption" | "forecast" | "asks" };
export type HubAlert = {
  id: string; // scope, night and audience: one alert per audience per night
  date: string; // the night it is about
  night: string;
  audience: Audience;
  recipients: string[];
  send: { date: string; hour: number; due: boolean }; // Birmingham wall time
  triggers: Trigger[];
  numbers: { lowF: number | null; people: number; low: number; high: number; capacity: number; spill: number };
  message: string;
};

type NightLike = { day: ForecastDay; results: RuleResult[]; prediction: NightPrediction };
const addDays = (date: string, n: number) => new Date(Date.parse(date + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const weekday = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
export const hourLabel = (h: number) => (h === 12 ? "noon" : `${h % 12 || 12} ${h < 12 ? "a.m." : "p.m."}`);

/**
 * Pure: turn the week's fired rules, spills and open asks into a queue.
 * Several triggers on one night merge into one alert per audience, so nobody is told twice.
 */
export function buildAlerts(nights: NightLike[], openAsks: Ask[], sites: Site[], now: { date: string; hour: number }, scope = "live"): HubAlert[] {
  const warmingSites = sites.filter((s) => s.type === "warming" && !s.confidentialLocation).map((s) => s.name.replace(/ Warming Station$/, ""));
  const out = new Map<string, HubAlert>();

  nights.forEach((n, i) => {
    const p = n.prediction;
    const people = expectedPeople(p);
    const spill = Math.round(p.spill);
    const name = weekday(n.day.date);
    const night = i === 0 ? "Tonight" : name;
    const when = i === 0 ? "tonight" : `${name} night`;
    const numbers = { lowF: n.day.lowF, people, low: Math.round(p.low), high: Math.round(p.high), capacity: p.capacity, spill };
    const warming = n.results.some((r) => r.ruleId === "warming-station-likely" && r.fired);

    const add = (audience: Audience, trigger: Trigger, recipients: string[]) => {
      const key = `${n.day.date}:${audience}`;
      let a = out.get(key);
      if (!a) {
        const lead = LEAD[audience];
        let date = addDays(n.day.date, -lead.daysBefore);
        let hour = lead.hour;
        const due = date < now.date || (date === now.date && hour <= now.hour);
        if (due) { date = now.date; hour = now.hour; }
        a = { id: `${scope}:${key}`, date: n.day.date, night, audience, recipients, send: { date, hour, due }, triggers: [], numbers, message: "" };
        out.set(key, a);
      }
      if (!a.triggers.some((t) => t.id === trigger.id)) a.triggers.push(trigger);
    };

    for (const r of n.results.filter((x) => x.fired)) {
      const rule = RULES.find((x) => x.id === r.ruleId)!;
      const t: Trigger = { id: rule.id, label: rule.short, reason: r.reason, kind: rule.kind };
      add("shelter_staff", t, ["Firehouse Ministries"]);
      add("volunteers", t, ["Signed-up volunteers"]);
      if (rule.id === "warming-station-likely") add("warming_operators", t, [...warmingSites, "outreach team"]);
    }
    if (spill >= 1) {
      const t: Trigger = { id: "forecast-spill", label: "Forecast over capacity", reason: `About ${people} people predicted for ${p.capacity} beds: ${spill} more than beds.`, kind: "forecast" };
      add("shelter_staff", t, ["Firehouse Ministries"]);
      add("volunteers", t, ["Signed-up volunteers"]);
      if (warming) add("warming_operators", t, [...warmingSites, "outreach team"]);
    }
    const asks = openAsks.filter((a) => a.date === n.day.date);
    if (asks.length) add("donors", { id: "open-asks", label: "Open asks", reason: `${asks.length} open request${asks.length > 1 ? "s" : ""} on the needs board for ${when}.`, kind: "asks" }, ["Donor list"]);

    const low = `low of ${n.day.lowF}°F`;
    const set = (audience: Audience, message: string) => { const a = out.get(`${n.day.date}:${audience}`); if (a) a.message = message; };
    set("shelter_staff", `${night}: ${low}. About ${people} people expected at Firehouse (${p.capacity} beds)${spill >= 1 ? `, about ${spill} over capacity` : ""}. ${n.results.filter((r) => r.fired).map((r) => RULES.find((x) => x.id === r.ruleId)!.short).join("; ") || "No activation rule fires"}.`);
    set("warming_operators", `Warming station likely ${when}: ${low}. The city decides each opening; please confirm.${spill >= 1 ? ` Firehouse expects about ${spill} more people than beds.` : ""}`);
    set("volunteers", `Firehouse needs ${quantities(people, n.day.lowF, n.day.alerts).volunteers} volunteers ${when}: ${low}, about ${people} guests expected. Sign up in the volunteer app.`);
    set("donors", `Firehouse needs ${asks.map(askText).join(", ")} ${i === 0 ? "by tonight" : `by ${name} night`}. ${low[0].toUpperCase()}${low.slice(1)}, about ${people} people expected. Pledge on the public needs board.`);
  });

  return [...out.values()].sort((a, b) => a.send.date.localeCompare(b.send.date) || a.send.hour - b.send.hour || a.date.localeCompare(b.date) || AUDIENCES.indexOf(a.audience) - AUDIENCES.indexOf(b.audience));
}
