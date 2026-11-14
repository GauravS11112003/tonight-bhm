import type { ForecastDay, NightPrediction } from "@/lib/types";
import { fitGBM, type Monotone } from "./gbm";
import { fitOLS } from "./ols";
import { CAPACITY, context, features, simulateHistory, type HistoryRow } from "./simulate";

// Two models compete on the same nights; the one with the lower held-out error is the
// "champion" and drives every forecast on screen. Rules still override both.
export type ModelId = "ols" | "gbm";
export const MODEL_NAME: Record<ModelId, string> = { ols: "Linear regression", gbm: "Gradient-boosted trees" };
export const BAND_Z = 1.28; // ≈ 80% two-sided interval under a normal residual

// Linear regression sees the original five inputs. Trees also see the raw low (so they
// can find the freezing jump) and the cold streak.
const olsX = (r: { C: number; P: number; W: number; H: number; M: number }) => [r.C, r.P, r.W, r.H, r.M];
export const GBM_FEATURES = ["Overnight low", "Chance of rain", "Weekend", "Holiday", "First 3 days of month", "Cold streak"] as const;
const MONO: Monotone[] = [-1, 1, 0, 0, 0, 1]; // colder, wetter, longer cold spell: never fewer people
type Inputs = { lowF: number; C: number; P: number; W: number; H: number; M: number; streak: number };
const gbmX = (r: Inputs) => [r.lowF, r.P, r.W, r.H, r.M, r.streak];

/**
 * Held-out nights: every fifth week across both years, so the test covers winters
 * and summers alike. The models never train on these nights.
 */
export const isHeldOut = (i: number) => Math.floor(i / 7) % 5 === 4;

type Scored = { date: string; lowF: number; actual: number; predicted: number };
function score(rows: HistoryRow[], predict: (r: HistoryRow) => number) {
  const out: Scored[] = rows.map((r) => ({ date: r.date, lowF: r.lowF, actual: r.demand, predicted: Math.max(0, predict(r)) }));
  const err = out.map((o) => o.actual - o.predicted);
  const mae = (xs: Scored[]) => xs.reduce((s, o) => s + Math.abs(o.actual - o.predicted), 0) / Math.max(1, xs.length);
  const freezing = out.filter((o) => o.lowF <= 32);
  const sd = Math.sqrt(err.reduce((s, e) => s + e * e, 0) / Math.max(1, err.length - 1));
  return { backtest: out, mae: mae(out), freezeMae: mae(freezing), freezeNights: freezing.length, residualSD: sd };
}

export function train(rows: HistoryRow[]) {
  const ols = fitOLS(rows.map(olsX), rows.map((r) => r.demand));
  const gbm = fitGBM(rows.map(gbmX), rows.map((r) => r.demand), MONO);
  return { ols, gbm };
}

function build() {
  const history = simulateHistory();
  const trainRows = history.filter((_, i) => !isHeldOut(i));
  const testRows = history.filter((_, i) => isHeldOut(i));
  const { ols, gbm } = train(trainRows);
  const results = {
    ols: { ...score(testRows, (r) => ols.predict(olsX(r))), predict: (r: Inputs) => ols.predict(olsX(r)) },
    gbm: { ...score(testRows, (r) => gbm.predict(gbmX(r))), predict: (r: Inputs) => gbm.predict(gbmX(r)) },
  };
  const champion: ModelId = results.gbm.mae < results.ols.mae ? "gbm" : "ols";
  return { history, trainRows, testRows, ols, gbm, results, champion };
}

export const ARENA = build();
export const HOLDOUT = ARENA.testRows.length;

// Kept for the /about page, which explains the linear model's formula and weights.
export const MODEL = { history: ARENA.history, fit: ARENA.ols, backtest: ARENA.results.ols.backtest, mae: ARENA.results.ols.mae };
export const COEFFICIENTS = {
  intercept: ARENA.ols.beta[0], C: ARENA.ols.beta[1], P: ARENA.ols.beta[2], W: ARENA.ols.beta[3], H: ARENA.ols.beta[4], M: ARENA.ols.beta[5],
};

/** One night's raw prediction from a given model. prevLows = the lows of the nights before, oldest first. */
export function rawFor(model: ModelId, day: ForecastDay, prevLows: number[] = []) {
  const lowF = day.lowF ?? 50; // a night with no low (rare NWS gap) is treated as 50°F: no cold effect
  const f = features(day.date, lowF, day.precipProb);
  return ARENA.results[model].predict({ lowF, ...f, ...context(lowF, prevLows) });
}

export function predictNight(day: ForecastDay, capacity = CAPACITY, prevLows: number[] = []): NightPrediction {
  const model = ARENA.champion;
  const raw = rawFor(model, day, prevLows);
  const half = BAND_Z * ARENA.results[model].residualSD;
  const clip = (v: number) => Math.min(capacity, Math.max(0, v));
  return {
    date: day.date,
    raw,
    predicted: clip(raw),
    low: clip(raw - half),
    high: clip(raw + half),
    spill: Math.max(0, raw - capacity),
    capacity,
    model,
    challenger: rawFor(model === "gbm" ? "ols" : "gbm", day, prevLows),
  };
}

/**
 * The data moat, measured: train both models on more and more nights and score each on
 * the same held-out weeks. Uses a longer SIMULATED history (6 years) to show where the
 * curves go as real nightly counts accumulate. Server-only: it trains 12 models.
 */
export function learningCurve(sizes = [60, 120, 240, 480, 960, 1700]) {
  const long = simulateHistory("2026-11-13", 6 * 365, 1205);
  const trainRows = long.filter((_, i) => !isHeldOut(i));
  const testRows = long.filter((_, i) => isHeldOut(i));
  return sizes.map((n) => {
    const { ols, gbm } = train(trainRows.slice(-n));
    return {
      nights: n,
      ols: score(testRows, (r) => ols.predict(olsX(r))).mae,
      gbm: score(testRows, (r) => gbm.predict(gbmX(r))).mae,
    };
  });
}

/** How each model's answer moves with tonight's low, holding everything else at an ordinary weeknight. */
export function dependence(from = 10, to = 60, step = 2) {
  const out: { lowF: number; ols: number; gbm: number }[] = [];
  for (let lowF = from; lowF <= to; lowF += step) {
    const day: ForecastDay = { date: "2026-11-18", name: "", lowF, highF: null, precipProb: 0.2, alerts: [], shortForecast: "" };
    out.push({ lowF, ols: rawFor("ols", day), gbm: rawFor("gbm", day) });
  }
  return out;
}

export type { HistoryRow };
