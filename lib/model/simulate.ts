// SIMULATED history. No public daily shelter counts exist for Birmingham, so we
// generate two years of nightly Firehouse occupancy with a fixed seed.
// Calibrated so the mean is ~81 people/night (29,509 shelter nights ÷ 365 in 2025).
// Effect directions follow Jadidzadeh & Kneebone (2015), Calgary shelter study.

export const CAPACITY = 100;
export const TARGET_MEAN = 29509 / 365; // ≈ 80.8
export const SEED = 205; // Birmingham's area code. Any fixed number works.

/** mulberry32: tiny, deterministic PRNG so the history is identical on every machine. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(r: () => number) {
  // Box–Muller
  return Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const d = new Date(Date.UTC(year, month, 1));
  const shift = (weekday - d.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + shift + (n - 1) * 7));
}
function lastWeekday(year: number, month: number, weekday: number) {
  const d = new Date(Date.UTC(year, month + 1, 0));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - weekday + 7) % 7));
  return d;
}

/** US federal holidays that change services and staffing at shelters. */
export function holidays(year: number): Set<string> {
  return new Set([
    `${year}-01-01`,
    iso(nthWeekday(year, 0, 1, 3)), // MLK Day
    iso(lastWeekday(year, 4, 1)), // Memorial Day
    `${year}-07-04`,
    iso(nthWeekday(year, 8, 1, 1)), // Labor Day
    `${year}-11-11`,
    iso(nthWeekday(year, 10, 4, 4)), // Thanksgiving
    `${year}-12-24`,
    `${year}-12-25`,
    `${year}-12-31`,
  ]);
}

export type Features = { C: number; P: number; W: number; H: number; M: number };

/** Turn one night's facts into the model's inputs. Shared by training and forecasting. */
export function features(date: string, lowF: number, precipProb: number): Features {
  const d = new Date(date + "T12:00:00Z");
  const dow = d.getUTCDay();
  return {
    C: Math.max(0, 50 - lowF),
    P: precipProb,
    W: dow === 0 || dow === 6 ? 1 : 0,
    H: holidays(d.getUTCFullYear()).has(date) ? 1 : 0,
    M: d.getUTCDate() <= 3 ? 1 : 0,
  };
}

/**
 * Extra context the tree model may use: streak = consecutive nights below 40°F ending
 * tonight (1 if only tonight is cold, 0 if tonight is not cold). Needs the nights before.
 */
export type Context = { streak: number };
export function context(lowF: number, prevLows: number[]): Context {
  let streak = lowF < 40 ? 1 : 0;
  for (let i = prevLows.length - 1; i >= 0 && streak > 0 && prevLows[i] < 40; i--) streak++;
  return { streak };
}

// occupancy = people in a bed (capped at 100). demand = occupancy + people turned away.
// We train on demand, which assumes shelters log turn-aways: see DECISIONS.md.
export type HistoryRow = { date: string; lowF: number; precipProb: number; occupancy: number; demand: number } & Features & Context;

/**
 * Seasonal low for Birmingham: ~35°F in mid-January, ~72°F in mid-July
 * (NOAA 1991–2020 normals, rounded). Plus day-to-day noise.
 */
function seasonalLow(dayOfYear: number) {
  return 53.5 - 18.5 * Math.cos((2 * Math.PI * (dayOfYear - 15)) / 365);
}

// The "true" effects the simulator uses. The linear ones are what the regression can see.
// FREEZE and STREAK are not linear, on purpose: our assumption (not a measured fact) is
// that more people come in once it freezes and stay in through a cold spell. Without them
// the simulation would be linear by construction and every comparison would be rigged
// in favour of linear regression.
const TRUE = { C: 0.85, P: 5, W: -3, H: 4, M: 3, noise: 4.5, FREEZE: 6, STREAK: 1.5 };

export function simulateHistory(endDate = "2026-11-13", days = 730, seed = SEED): HistoryRow[] {
  const r = rng(seed);
  const end = new Date(endDate + "T12:00:00Z");
  const rows: Omit<HistoryRow, "occupancy" | "demand">[] = [];
  const signal: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - i);
    const date = iso(d);
    const doy = Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
    const lowF = Math.round(seasonalLow(doy) + gaussian(r) * 6);
    const precipProb = Math.round(Math.min(1, Math.max(0, r() < 0.35 ? 0.3 + r() * 0.7 : r() * 0.2)) * 100) / 100;
    const f = features(date, lowF, precipProb);
    const ctx = context(lowF, rows.slice(-6).map((x) => x.lowF));
    rows.push({ date, lowF, precipProb, ...f, ...ctx });
    const nonlinear = (lowF <= 32 ? TRUE.FREEZE : 0) + TRUE.STREAK * Math.min(Math.max(ctx.streak - 1, 0), 4);
    signal.push(TRUE.C * f.C + TRUE.P * f.P + TRUE.W * f.W + TRUE.H * f.H + TRUE.M * f.M + nonlinear + gaussian(r) * TRUE.noise);
  }
  // Pick the baseline so the capped mean lands on Firehouse's real 2025 average.
  let base = TARGET_MEAN - signal.reduce((a, b) => a + b, 0) / signal.length;
  for (let k = 0; k < 5; k++) {
    const mean = signal.reduce((a, s) => a + Math.min(CAPACITY, Math.max(0, base + s)), 0) / signal.length;
    base += TARGET_MEAN - mean;
  }
  return rows.map((row, i) => {
    const demand = Math.round(Math.max(0, base + signal[i]));
    return { ...row, demand, occupancy: Math.min(CAPACITY, demand) };
  });
}
