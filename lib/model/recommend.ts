import { ASK_FORMULAS, expectedPeople, quantities } from "@/lib/asks";
import type { ForecastDay, NightPrediction, RuleResult } from "@/lib/types";

// Planning formulas. Deliberately simple so staff can check them by hand.
// Staffing and blankets come from lib/asks, so the dashboard, the volunteer
// screens and the needs board always show the same numbers.
export const FORMULAS = {
  // One volunteer per 25 guests, rounded up. A typical 81-guest night needs 4.
  volunteersPerGuests: ASK_FORMULAS.peoplePerVolunteer,
  baselineVolunteers: 4,
  // 1.5 blankets per expected guest on nights below 40°F.
  blanketsPerGuest: ASK_FORMULAS.blanketsPerPerson,
  blanketColdF: ASK_FORMULAS.blanketBelowF,
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
  const { volunteers, blankets } = quantities(expectedPeople(p), day.lowF, day.alerts);
  return {
    date: day.date,
    volunteers,
    extraVolunteers: Math.max(0, volunteers - FORMULAS.baselineVolunteers),
    blankets,
    warming: results.find((r) => r.ruleId === "warming-station-likely")?.fired ?? false,
    dayShelterExtra: results.find((r) => r.ruleId === "firehouse-day-extra")?.fired ?? false,
  };
}
