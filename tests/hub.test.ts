import { describe, expect, it } from "vitest";
import sites from "@/data/sites.json";
import { buildAsks, quantities, toPublic } from "@/lib/asks";
import { AUDIENCES, buildAlerts } from "@/lib/notify/alerts";
import { cell, summarize, simulateIntakes, type IntakeEvent } from "@/lib/insights";
import { evaluateAll } from "@/lib/rules/engine";
import type { ForecastDay, NightPrediction, Site } from "@/lib/types";

const SITES = sites as Site[];
const firehouse = SITES.find((s) => s.id === "firehouse-shelter")!;
const night = (date: string, lowF: number, people: number) => {
  const day: ForecastDay = { date, name: "", lowF, highF: lowF + 15, precipProb: 0.2, alerts: [], shortForecast: "" };
  const prediction: NightPrediction = { date, raw: people, predicted: Math.min(100, people), low: Math.min(100, people - 8), high: Math.min(100, people + 8), spill: Math.max(0, people - 100), capacity: 100 };
  return { day, results: evaluateAll(day), prediction };
};

describe("asks", () => {
  it("a night below 40°F at 100 predicted people asks for 150 blankets and 4 volunteers", () => {
    expect(quantities(100, 30, [])).toMatchObject({ blankets: 150, volunteers: 4, meals: 300, water: 0 });
    const asks = buildAsks([night("2026-11-17", 30, 100)], firehouse);
    expect(asks.find((a) => a.kind === "blankets")?.qty).toBe(150);
    expect(asks.find((a) => a.kind === "volunteers")?.qty).toBe(4);
  });
  it("a mild night produces no blanket ask, and a confidential site is never named in public", () => {
    expect(quantities(100, 55, []).blankets).toBe(0);
    expect(buildAsks([night("2026-11-17", 55, 80)], firehouse)).toHaveLength(0);
    const [ask] = buildAsks([night("2026-11-17", 30, 100)], firehouse);
    expect(toPublic(ask, { confidentialLocation: true }).siteName).not.toContain("Firehouse");
  });
});

describe("notify", () => {
  it("a fired rule creates exactly one alert per audience per night", () => {
    // 24°F fires both rules and 104 people spills: three triggers, still one alert each.
    const nights = [night("2026-11-17", 24, 104), night("2026-11-18", 55, 80)];
    const alerts = buildAlerts(nights, buildAsks(nights, firehouse), SITES, { date: "2026-11-14", hour: 9 });
    for (const audience of AUDIENCES) expect(alerts.filter((a) => a.date === "2026-11-17" && a.audience === audience)).toHaveLength(1);
    expect(new Set(alerts.map((a) => a.id)).size).toBe(alerts.length);
    expect(alerts.filter((a) => a.date === "2026-11-18")).toHaveLength(0);
    expect(alerts.find((a) => a.audience === "shelter_staff")!.triggers.map((t) => t.id)).toEqual(["firehouse-day-extra", "warming-station-likely", "forecast-spill"]);
  });
});

describe("insights", () => {
  it("a need group with 3 intakes displays \"<5\"", () => {
    const events: IntakeEvent[] = [
      ...Array.from({ length: 3 }, () => ({ date: "2026-11-12", needs: ["medical" as const], topSite: null })),
      ...Array.from({ length: 6 }, () => ({ date: "2026-11-12", needs: ["food" as const], topSite: null })),
    ];
    const s = summarize(events, [], "2026-11-14");
    const row = (need: string) => s.rows.find((r) => r.need === need)!;
    expect(row("medical").thisWeek).toBeNull();
    expect(cell(row("medical").thisWeek)).toBe("<5");
    expect(cell(row("food").thisWeek)).toBe("6");
    expect(row("medical").changePct).toBeNull();
  });
  it("the simulated history is the same every time", () => {
    expect(simulateIntakes("2026-11-14")).toEqual(simulateIntakes("2026-11-14"));
  });
});
