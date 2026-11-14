import type { ForecastDay, NightPrediction } from "@/lib/types";
import { fitOLS } from "./ols";
import { CAPACITY, features, simulateHistory, type Features, type HistoryRow } from "./simulate";

const ORDER: (keyof Features)[] = ["C", "P", "W", "H", "M"];
const toX = (f: Features) => ORDER.map((k) => f[k]);
export const BAND_Z = 1.28; // ≈ 80% two-sided interval under a normal residual

export const HOLDOUT = 60;

/**
 * Train on all but the last 60 simulated nights, then score those 60.
 * We forecast with this same model, so the backtest error is the error
 * of the model actually on screen.
 */
function build() {
  const history = simulateHistory();
  const train = history.slice(0, -HOLDOUT);
  const test = history.slice(-HOLDOUT);
  const fit = fitOLS(train.map(toX), train.map((r) => r.occupancy));
  const clip = (v: number) => Math.min(CAPACITY, Math.max(0, v));
  const backtest = test.map((r) => ({ date: r.date, actual: r.occupancy, predicted: clip(fit.predict(toX(r))) }));
  const mae = backtest.reduce((s, b) => s + Math.abs(b.actual - b.predicted), 0) / backtest.length;
  return { history, fit, backtest, mae };
}

export const MODEL = build();

export const COEFFICIENTS = {
  intercept: MODEL.fit.beta[0],
  C: MODEL.fit.beta[1],
  P: MODEL.fit.beta[2],
  W: MODEL.fit.beta[3],
  H: MODEL.fit.beta[4],
  M: MODEL.fit.beta[5],
};

export function predictNight(day: ForecastDay, capacity = CAPACITY): NightPrediction {
  // A night with no low (rare NWS gap) is treated as 50°F, i.e. no cold effect.
  const f = features(day.date, day.lowF ?? 50, day.precipProb);
  const raw = MODEL.fit.predict(toX(f));
  const half = BAND_Z * MODEL.fit.residualSD;
  const clip = (v: number) => Math.min(capacity, Math.max(0, v));
  return {
    date: day.date,
    raw,
    predicted: clip(raw),
    low: clip(raw - half),
    high: clip(raw + half),
    spill: Math.max(0, raw - capacity),
    capacity,
  };
}

export type { HistoryRow };
