import type { ForecastDay, NightPrediction, RuleResult } from "@/lib/types";

// Planning formulas. Deliberately simple so staff can check them by hand.
export const FORMULAS = {
  // One volunteer per 20 guests, rounded up. A typical 81-guest night needs 5.
  volunteersPerGuests: 20,
  baselineVolunteers: 5,
  // 1.5 blankets per expected guest on nights below 40°F, using the top of the range,
  // so wet blankets can be swapped. Rounded up to the nearest 10.
  blanketsPerGuest: 1.5,
  blanketColdF: 40,
  // City cost per warming station per night (Birmingham Watch reporting).
  warmingCostPerNight: 2500,
  warmingStations: 2,
};

export type NightPlan = {
  date: string;
  volunteers: number;
  extraVolunteers: number;
  blankets: number;
  warming: boolean;
  dayShelterExtra: boolean;
};

export function planNight(day: ForecastDay, p: NightPrediction, results: RuleResult[]): NightPlan {
  const volunteers = Math.ceil((p.predicted + p.spill) / FORMULAS.volunteersPerGuests);
  const cold = (day.lowF ?? 99) < FORMULAS.blanketColdF;
  const blankets = cold ? Math.ceil((FORMULAS.blanketsPerGuest * (p.high + p.spill)) / 10) * 10 : 0;
  return {
    date: day.date,
    volunteers,
    extraVolunteers: Math.max(0, volunteers - FORMULAS.baselineVolunteers),
    blankets,
    warming: results.find((r) => r.ruleId === "warming-station-likely")?.fired ?? false,
    dayShelterExtra: results.find((r) => r.ruleId === "firehouse-day-extra")?.fired ?? false,
  };
}
