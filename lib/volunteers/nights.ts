import type { Night } from "@/lib/plan";

// The slice of the forecast the volunteer screens need, safe to send to the browser.
export type NightBrief = {
  date: string; label: string; lowF: number | null; alerts: string[];
  predicted: number; low: number; high: number; spill: number;
  needed: number; extra: number; blankets: number; warming: boolean; dayExtra: boolean;
  reasons: string[];
};

export function toBrief(n: Night, i: number): NightBrief {
  const d = new Date(n.day.date + "T12:00:00Z");
  return {
    date: n.day.date,
    label: i === 0 ? "Tonight" : d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
    lowF: n.day.lowF, alerts: n.day.alerts,
    predicted: Math.round(n.prediction.predicted), low: Math.round(n.prediction.low), high: Math.round(n.prediction.high), spill: Math.round(n.prediction.spill),
    needed: n.plan.volunteers, extra: n.plan.extraVolunteers, blankets: n.plan.blankets,
    warming: n.plan.warming, dayExtra: n.plan.dayShelterExtra,
    reasons: n.results.filter((r) => r.fired).map((r) => r.reason),
  };
}
