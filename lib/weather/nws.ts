import fs from "node:fs/promises";
import path from "node:path";
import type { ForecastDay, ForecastSource } from "@/lib/types";

// Downtown Birmingham. We look up the grid from this point at runtime
// instead of hardcoding BMX/59,84, because NWS can re-grid offices.
const POINT = "33.5186,-86.8104";
const BASE = "https://api.weather.gov";
const CACHE_MS = 10 * 60 * 1000;
const SNAPSHOT = path.join(process.cwd(), "data", "cached_forecast.json");

// NWS rejects requests without a User-Agent that names a contact.
const UA = `(tonight-bhm hackathon, ${process.env.NWS_CONTACT ?? "tonight-bhm@example.com"})`;

type Period = {
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  probabilityOfPrecipitation?: { value: number | null };
  shortForecast: string;
};
type Alert = { properties: { event: string; onset: string | null; effective: string; ends: string | null; expires: string } };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/geo+json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`NWS ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

/** Local calendar date of an NWS timestamp. NWS already sends local offsets (-06:00). */
const localDate = (iso: string) => iso.slice(0, 10);

function addDays(date: string, n: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Turn NWS 12-hour periods into one row per night.
 * A "day" here is a date whose night we plan for: high = that date's daytime
 * period, low = the night period that starts that evening.
 */
export function normalize(periods: Period[], alerts: Alert[]): ForecastDay[] {
  const byDate = new Map<string, ForecastDay>();
  for (const p of periods) {
    const date = localDate(p.startTime);
    const row =
      byDate.get(date) ??
      { date, name: "", lowF: null, highF: null, precipProb: 0, alerts: [], shortForecast: "" };
    const pop = (p.probabilityOfPrecipitation?.value ?? 0) / 100;
    row.precipProb = Math.max(row.precipProb, pop);
    if (p.isDaytime) {
      row.highF = p.temperature;
      row.name = p.name;
      row.shortForecast = p.shortForecast;
    } else {
      row.lowF = p.temperature;
      if (!row.name) row.name = p.name; // first period may be "Tonight"
      if (!row.shortForecast) row.shortForecast = p.shortForecast;
    }
    byDate.set(date, row);
  }

  const days = [...byDate.values()].filter((d) => d.lowF !== null).slice(0, 7);

  // An alert belongs to a night if it overlaps 6 p.m. that date → 7 a.m. next date.
  for (const d of days) {
    const nightStart = Date.parse(`${d.date}T18:00:00-06:00`);
    const nightEnd = Date.parse(`${addDays(d.date, 1)}T07:00:00-06:00`);
    for (const a of alerts) {
      const start = Date.parse(a.properties.onset ?? a.properties.effective);
      const end = Date.parse(a.properties.ends ?? a.properties.expires);
      if (start < nightEnd && end > nightStart && !d.alerts.includes(a.properties.event)) {
        d.alerts.push(a.properties.event);
      }
    }
  }
  return days;
}

let memo: { at: number; days: ForecastDay[]; source: ForecastSource } | null = null;

async function fetchLive(): Promise<ForecastDay[]> {
  const point = await getJson<{ properties: { forecast: string; forecastHourly: string } }>(`${BASE}/points/${POINT}`);
  const [forecast, hourly, alerts] = await Promise.all([
    getJson<{ properties: { periods: Period[] } }>(point.properties.forecast),
    // Hourly is optional: it only sharpens precipitation, so a failure is not fatal.
    getJson<{ properties: { periods: Period[] } }>(point.properties.forecastHourly).catch(() => null),
    getJson<{ features: Alert[] }>(`${BASE}/alerts/active?point=${POINT}`).catch(() => ({ features: [] })),
  ]);
  const days = normalize(forecast.properties.periods, alerts.features);
  if (hourly) {
    for (const d of days) {
      const night = hourly.properties.periods.filter((h) => {
        const t = Date.parse(h.startTime);
        return t >= Date.parse(`${d.date}T18:00:00-06:00`) && t < Date.parse(`${addDays(d.date, 1)}T07:00:00-06:00`);
      });
      for (const h of night) d.precipProb = Math.max(d.precipProb, (h.probabilityOfPrecipitation?.value ?? 0) / 100);
    }
  }
  return days;
}

/** Live forecast with a 10-minute memo; falls back to the last saved snapshot. */
export async function getForecast(): Promise<{ days: ForecastDay[]; source: ForecastSource }> {
  if (memo && Date.now() - memo.at < CACHE_MS) return memo;
  try {
    const days = await fetchLive();
    const source: ForecastSource = { kind: "live", fetchedAt: new Date().toISOString() };
    memo = { at: Date.now(), days, source };
    await fs.writeFile(SNAPSHOT, JSON.stringify({ fetchedAt: source.fetchedAt, days }, null, 2)).catch(() => {});
    return memo;
  } catch (err) {
    const snap = JSON.parse(await fs.readFile(SNAPSHOT, "utf8")) as { fetchedAt: string; days: ForecastDay[] };
    return {
      days: snap.days,
      source: { kind: "cached", fetchedAt: snap.fetchedAt, note: (err as Error).message },
    };
  }
}
