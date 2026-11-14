import CityMap from "@/components/CityMap";
import { buildHub, tonightSites } from "@/lib/hub";
import { expectedPeople } from "@/lib/asks";
import { simulateIntakes, summarize } from "@/lib/insights";
import { readEvents } from "@/lib/insights/store.server";
import { RULES } from "@/lib/rules/engine";
import { toBrief } from "@/lib/volunteers/nights";

// The hub home: Birmingham in 3D, with the four verbs (Understand, Route, Notify, Ask)
// and tonight's places floating over it. Every number is computed from the forecast.
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const scenario = (await searchParams).scenario === "arctic";
  const { nights, source, asks, alerts } = await buildHub(scenario);
  const t = nights[0];
  const today = t.day.date;
  const summary = summarize(simulateIntakes(today), readEvents().filter((e) => e.date === today), today);
  const week = nights.map(toBrief);

  return (
    <CityMap
      tonight={week[0]}
      sites={tonightSites(t)}
      scenario={scenario}
      source={source}
      fired={t.results.filter((r) => r.fired).map((r) => RULES.find((x) => x.id === r.ruleId)!.short)}
      hub={{
        top: summary.top ? { label: summary.top.label, changePct: summary.top.changePct!, bars: summary.top.bar } : null,
        room: { predicted: Math.min(t.prediction.capacity, expectedPeople(t.prediction)), capacity: t.prediction.capacity, spill: Math.round(t.prediction.spill) },
        alerts: alerts.map((a) => ({ id: a.id, night: a.night, date: a.date })),
        asks: asks.map((a) => ({ id: a.id })),
        week: week.map((n) => ({ date: n.date, label: n.label === "Tonight" ? new Date(n.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }) : n.label })),
      }}
    />
  );
}
