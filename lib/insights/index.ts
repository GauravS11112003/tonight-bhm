import { NEEDS } from "@/lib/intake/schema";
import type { Need } from "@/lib/types";

// Needs insights: counts of confirmed need tags, by day and by need. Aggregates only.
// An intake event holds a date, the confirmed need tags and the top site id. Nothing else:
// no note, no age, no gender, no device id, no time of day.
export type IntakeEvent = { date: string; needs: Need[]; topSite: string | null };

export const NEED_LABEL: Record<Need, string> = {
  shelter_tonight: "Shelter tonight", warmth: "Warmth", food: "Food", medical: "Medical", showers: "Showers", housing_longterm: "Long-term housing",
};

// Small-cell suppression: a group with fewer than 5 intakes is never shown as an exact number.
export const SUPPRESS_BELOW = 5;
export type Cell = number | null; // null = suppressed
export const suppress = (n: number): Cell => (n < SUPPRESS_BELOW ? null : n);
export const cell = (n: Cell) => (n === null || n < SUPPRESS_BELOW ? `<${SUPPRESS_BELOW}` : n.toLocaleString("en-US"));

const addDays = (date: string, n: number) => new Date(Date.parse(date + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const INTAKE_SEED = 311;
export const HISTORY_DAYS = 14;
/**
 * SIMULATED intake history for the 14 days before today, fixed seed. It exists so the
 * insights page has something to aggregate before real intakes accumulate. Warmth is
 * made to rise through the fortnight; every screen that uses it says SIMULATED.
 */
export function simulateIntakes(today: string, seed = INTAKE_SEED): IntakeEvent[] {
  const rng = mulberry32(seed);
  const sites: [string | null, number][] = [["firehouse-shelter", 0.5], ["first-light", 0.2], ["firehouse-day", 0.14], ["jimmie-hale-warming", 0.09], [null, 0.07]];
  const events: IntakeEvent[] = [];
  for (let d = HISTORY_DAYS; d >= 1; d--) {
    const k = HISTORY_DAYS - d; // 0 = oldest day
    const p: Record<Need, number> = { shelter_tonight: 0.6 + 0.006 * k, warmth: 0.34 + 0.011 * k, food: 0.5, medical: 0.13, showers: 0.1, housing_longterm: 0.26 - 0.004 * k };
    const n = 30 + Math.floor(rng() * 14);
    for (let i = 0; i < n; i++) {
      const needs = NEEDS.filter((need) => rng() < p[need]);
      let r = rng(), topSite: string | null = null;
      for (const [id, w] of sites) { if (r < w) { topSite = id; break; } r -= w; }
      events.push({ date: addDays(today, -d), needs: [...needs], topSite });
    }
  }
  return events;
}

export type NeedRow = {
  need: Need; label: string;
  daily: Cell[]; // 14 past days, oldest first, suppressed
  bar: number[]; // 0..1 height per day; suppressed days get 0
  thisWeek: Cell; lastWeek: Cell;
  changePct: number | null; // null when either week is suppressed
  today: Cell; // real intakes recorded today
};
export type Summary = { days: string[]; today: string; rows: NeedRow[]; rising: NeedRow[]; top: NeedRow | null; intakes: { thisWeek: number; lastWeek: number }; sites: { id: string | null; count: Cell }[] };

/**
 * Pure: aggregate events into the only shape the insights page may show.
 * Exact counts below 5 are replaced by null here, before anything reaches a browser.
 */
export function summarize(history: IntakeEvent[], todayEvents: IntakeEvent[], today: string): Summary {
  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => addDays(today, i - HISTORY_DAYS));
  const idx = new Map(days.map((d, i) => [d, i]));
  const count = (need: Need) => {
    const daily = new Array(HISTORY_DAYS).fill(0) as number[];
    for (const e of history) { const i = idx.get(e.date); if (i !== undefined && e.needs.includes(need)) daily[i]++; }
    return daily;
  };
  const raw = NEEDS.map((need) => ({ need, daily: count(need) }));
  const peak = Math.max(1, ...raw.flatMap((r) => r.daily));
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const rows: NeedRow[] = raw.map(({ need, daily }) => {
    const last = sum(daily.slice(0, 7)), cur = sum(daily.slice(7));
    const ok = last >= SUPPRESS_BELOW && cur >= SUPPRESS_BELOW;
    return {
      need, label: NEED_LABEL[need],
      daily: daily.map(suppress), bar: daily.map((v) => (v < SUPPRESS_BELOW ? 0 : v / peak)),
      thisWeek: suppress(cur), lastWeek: suppress(last),
      changePct: ok ? Math.round(((cur - last) / last) * 100) : null,
      today: suppress(todayEvents.filter((e) => e.needs.includes(need)).length),
    };
  });
  const rising = rows.filter((r) => r.changePct !== null).sort((a, b) => b.changePct! - a.changePct!);
  const perDay = (from: number, to: number) => history.filter((e) => { const i = idx.get(e.date); return i !== undefined && i >= from && i < to; }).length;
  const siteCounts = new Map<string | null, number>();
  for (const e of history) if ((idx.get(e.date) ?? -1) >= 7) siteCounts.set(e.topSite, (siteCounts.get(e.topSite) ?? 0) + 1);
  return {
    days, today, rows, rising, top: rising[0] && rising[0].changePct! > 0 ? rising[0] : null,
    intakes: { thisWeek: perDay(7, 14), lastWeek: perDay(0, 7) },
    sites: [...siteCounts.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, count: suppress(n) })),
  };
}
