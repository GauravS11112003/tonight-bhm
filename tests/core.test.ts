import { describe, expect, it } from "vitest";
import sites from "@/data/sites.json";
import { evaluate, RULES } from "@/lib/rules/engine";
import { fitOLS } from "@/lib/model/ols";
import { MODEL, predictNight } from "@/lib/model/forecast";
import { simulateHistory } from "@/lib/model/simulate";
import { normalize } from "@/lib/weather/nws";
import { route, type Intake } from "@/lib/routing/route";
import type { ForecastDay, Site } from "@/lib/types";

const day = (lowF: number, alerts: string[] = []): ForecastDay => ({
  date: "2026-11-18", name: "Wednesday", lowF, highF: 50, precipProb: 0.2, alerts, shortForecast: "",
});
const rule = (id: string) => RULES.find((r) => r.id === id)!;

describe("activation rules", () => {
  it("fires the Firehouse day-shelter rule below 40°F, with a readable reason", () => {
    const r = evaluate(day(28), rule("firehouse-day-extra"));
    expect(r.fired).toBe(true);
    expect(r.reason).toBe("Low of 28°F is below 40°F.");
  });
  it("does not fire at exactly 40°F", () => {
    expect(evaluate(day(40), rule("firehouse-day-extra")).fired).toBe(false);
  });
  it("fires on a Heat Advisory even on a warm night", () => {
    expect(evaluate(day(78, ["Heat Advisory"]), rule("firehouse-day-extra")).fired).toBe(true);
  });
  it("warming-station rule fires at 32°F and not at 33°F", () => {
    expect(evaluate(day(32), rule("warming-station-likely")).fired).toBe(true);
    expect(evaluate(day(33), rule("warming-station-likely")).fired).toBe(false);
  });
});

describe("model", () => {
  it("OLS recovers known coefficients exactly on noiseless data", () => {
    const X = [[0, 1], [1, 0], [2, 3], [5, 1], [3, 3]];
    const y = X.map(([a, b]) => 10 + 2 * a - 3 * b);
    const { beta } = fitOLS(X, y);
    expect(beta[0]).toBeCloseTo(10);
    expect(beta[1]).toBeCloseTo(2);
    expect(beta[2]).toBeCloseTo(-3);
  });
  it("simulated history is deterministic and calibrated to ~81 a night", () => {
    const a = simulateHistory();
    expect(simulateHistory()[100].occupancy).toBe(a[100].occupancy);
    const mean = a.reduce((s, r) => s + r.occupancy, 0) / a.length;
    expect(mean).toBeGreaterThan(79);
    expect(mean).toBeLessThan(83);
  });
  it("clips to capacity and reports spill on a brutal night", () => {
    const p = predictNight({ ...day(5), precipProb: 1 });
    expect(p.predicted).toBeLessThanOrEqual(100);
    expect(p.spill).toBeGreaterThan(0);
    expect(MODEL.mae).toBeGreaterThan(0);
  });
});

describe("weather normalize", () => {
  it("pairs a day high with that evening's low and attaches overnight alerts", () => {
    const days = normalize(
      [
        { name: "Today", startTime: "2026-11-14T11:00:00-06:00", endTime: "", isDaytime: true, temperature: 56, shortForecast: "Sunny" },
        { name: "Tonight", startTime: "2026-11-14T18:00:00-06:00", endTime: "", isDaytime: false, temperature: 33, shortForecast: "Frost", probabilityOfPrecipitation: { value: 10 } },
      ],
      [{ properties: { event: "Freeze Warning", onset: "2026-11-15T00:00:00-06:00", effective: "", ends: "2026-11-15T08:00:00-06:00", expires: "" } }],
    );
    expect(days[0]).toMatchObject({ date: "2026-11-14", highF: 56, lowF: 33, precipProb: 0.1, alerts: ["Freeze Warning"] });
  });
});

describe("routing", () => {
  const base: Intake = { ageBand: "25-54", gender: "woman", needsPlaceTonight: true, needs: ["shelter_tonight"], flags: { mobility: false, medication: false, sickNow: false } };
  const cold = { date: "2026-11-18", weekday: 3, lowF: 24, predictions: { "firehouse-shelter": predictNight(day(24)) },
    results: [evaluate(day(24), rule("firehouse-day-extra")), evaluate(day(24), rule("warming-station-likely"))] };

  it("excludes Firehouse for a woman and says why", () => {
    const { excluded } = route(base, sites as Site[], cold);
    const fh = excluded.find((r) => r.site.id === "firehouse-shelter")!;
    expect(fh.failed[0]).toMatch(/Serves men; this person is a woman/);
  });
  it("counts warming stations only when their rule fired", () => {
    const mild = { ...cold, lowF: 45, results: [evaluate(day(45), rule("warming-station-likely"))] };
    const { ranked } = route({ ...base, gender: "man" }, sites as Site[], mild);
    expect(ranked.some((r) => r.site.type === "warming")).toBe(false);
    const { ranked: coldRanked } = route({ ...base, gender: "man" }, sites as Site[], cold);
    expect(coldRanked.some((r) => r.site.id === "jimmie-hale-warming")).toBe(true);
  });
  it("excludes under-18s from Firehouse", () => {
    const { excluded } = route({ ...base, gender: "man", ageBand: "under-18" }, sites as Site[], cold);
    expect(excluded.map((r) => r.site.id)).toContain("firehouse-shelter");
  });
});
