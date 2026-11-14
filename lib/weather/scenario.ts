import type { ForecastDay } from "@/lib/types";

// Demo only. Overrides the next three nights with an arctic front so judges
// can see every rule fire even when today's weather is mild.
// The UI must show a "SCENARIO — not the live forecast" banner whenever this is used.
const FRONT = [
  { lowF: 28, highF: 41, precipProb: 0.7, shortForecast: "Rain changing to sleet", alerts: ["Freeze Warning"] },
  { lowF: 24, highF: 36, precipProb: 0.5, shortForecast: "Cold rain, then clearing", alerts: ["Hard Freeze Warning"] },
  { lowF: 31, highF: 44, precipProb: 0.6, shortForecast: "Rain likely", alerts: ["Freeze Warning"] },
];

export function applyArcticFront(days: ForecastDay[]): ForecastDay[] {
  return days.map((d, i) => (i < FRONT.length ? { ...d, ...FRONT[i] } : d));
}
