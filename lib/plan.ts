import { evaluateAll, RULES } from "@/lib/rules/engine";
import { predictNight } from "@/lib/model/forecast";
import { planNight, type NightPlan } from "@/lib/model/recommend";
import { getForecast } from "@/lib/weather/nws";
import { applyArcticFront } from "@/lib/weather/scenario";
import type { ForecastDay, ForecastSource, NightPrediction, RuleResult } from "@/lib/types";

export type Night = { day: ForecastDay; results: RuleResult[]; prediction: NightPrediction; plan: NightPlan };

/** The forecast → rules → model → plan pipeline, in one place. */
export async function buildWeek(scenario: boolean): Promise<{ nights: Night[]; source: ForecastSource }> {
  const { days, source } = await getForecast();
  const used = scenario ? applyArcticFront(days) : days;
  const nights = used.map((day) => {
    const results = evaluateAll(day, RULES);
    const prediction = predictNight(day);
    return { day, results, prediction, plan: planNight(day, prediction, results) };
  });
  return { nights, source: scenario ? { ...source, kind: "scenario" } : source };
}
