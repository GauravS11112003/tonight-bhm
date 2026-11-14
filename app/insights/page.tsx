import Link from "next/link";
import Nav from "@/components/Nav";
import { ASK_FORMULAS, expectedPeople } from "@/lib/asks";
import { buildHub, SITES } from "@/lib/hub";
import { cell, HISTORY_DAYS, INTAKE_SEED, simulateIntakes, summarize, SUPPRESS_BELOW, type NeedRow } from "@/lib/insights";
import { readEvents } from "@/lib/insights/store.server";
import type { Night } from "@/lib/plan";
import type { Need } from "@/lib/types";

export const dynamic = "force-dynamic";

const wd = (date: string, style: "short" | "long" = "short") => new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: style, timeZone: "UTC" });
const md = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** What the demand forecast says about each need, where it says anything. */
function forecastLine(need: Need, nights: Night[], meals: number): string {
  if (need === "shelter_tonight") {
    const peak = nights.reduce((a, b) => (expectedPeople(b.prediction) > expectedPeople(a.prediction) ? b : a));
    return `Forecast: Firehouse peaks at about ${expectedPeople(peak.prediction)} people for ${peak.prediction.capacity} beds on ${wd(peak.day.date, "long")}.`;
  }
  if (need === "warmth") {
    const cold = nights.filter((n) => (n.day.lowF ?? 99) < ASK_FORMULAS.blanketBelowF);
    const min = Math.min(...nights.map((n) => n.day.lowF ?? 99));
    return cold.length ? `Forecast: ${cold.length} of the next ${nights.length} nights below ${ASK_FORMULAS.blanketBelowF}°F; coldest ${min}°F.` : `Forecast: no night below ${ASK_FORMULAS.blanketBelowF}°F in the next ${nights.length}.`;
  }
  if (need === "food") return meals ? `Forecast: about ${meals.toLocaleString("en-US")} meals asked for across flagged nights.` : "Forecast: no flagged night, so no meal asks.";
  return "No forecast exists for this need.";
}

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="rounded-full bg-raised px-2.5 py-1 text-sm text-muted">too few to compare</span>;
  return <span className={`tnum rounded-full px-2.5 py-1 text-sm font-semibold ${pct > 0 ? "bg-accent text-white" : "bg-raised text-ink"}`}>{pct > 0 ? "+" : ""}{pct}%</span>;
}

/** Two bars per need: last week pale, this week solid. A suppressed week is a dashed stub. */
function WeekBars({ row, max, i }: { row: NeedRow; max: number; i: number }) {
  const bar = (v: number | null, solid: boolean, label: string, d: number) => (
    <div className="flex items-center gap-2.5">
      <span className="w-[68px] shrink-0 text-xs text-muted">{label}</span>
      <div className="h-3.5 min-w-0 flex-1">
        {v === null
          ? <div className="h-full w-9 rounded-full border border-dashed border-muted/60" />
          : <div className={`grow-x h-full rounded-full ${solid ? "bg-accent" : "bg-accent-track"}`} style={{ width: `${Math.max(3, (v / max) * 100)}%`, animationDelay: `${d}ms` }} />}
      </div>
      <span className="tnum w-9 shrink-0 text-right text-[15px] font-semibold">{cell(v)}</span>
    </div>
  );
  return <div className="grid gap-1.5">{bar(row.lastWeek, false, "Last week", 200 + i * 70)}{bar(row.thisWeek, true, "This week", 320 + i * 70)}</div>;
}

/** 14 days of one need as bars, then today's real count. Days under 5 are dashed stubs. */
function DayStrip({ row, days }: { row: NeedRow; days: string[] }) {
  return (
    <div className="flex h-[76px] items-end gap-[3px]" role="img" aria-label={`${row.label}: intakes per day for ${days.length} days; days with fewer than ${SUPPRESS_BELOW} are not shown as a number`}>
      {row.daily.map((v, k) => (
        <div key={days[k]} className="flex h-full min-w-0 flex-1 items-end" title={`${md(days[k])}: ${cell(v)}`}>
          {v === null
            ? <div className="h-[14%] w-full rounded-[3px] border border-dashed border-muted/60" />
            : <div className={`grow w-full rounded-[3px] ${k >= 7 ? "bg-accent" : "bg-accent-track"}`} style={{ height: `${Math.max(16, row.bar[k] * 100)}%`, ["--d" as string]: `${150 + k * 35}ms` }} />}
        </div>
      ))}
      <div className="ml-1.5 flex h-full w-[38px] shrink-0 flex-col items-center justify-end border-l border-line pl-1.5" title={`Today, real: ${cell(row.today)}`}>
        <span className="tnum text-[13px] font-semibold text-ink">{cell(row.today)}</span>
      </div>
    </div>
  );
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const scenario = (await searchParams).scenario === "arctic";
  const { nights, asks, source } = await buildHub(scenario);
  const today = nights[0].day.date;
  const todayEvents = readEvents().filter((e) => e.date === today);
  const s = summarize(simulateIntakes(today), todayEvents, today);
  const q = scenario ? "?scenario=arctic" : "";
  const max = Math.max(1, ...s.rows.flatMap((r) => [r.thisWeek ?? 0, r.lastWeek ?? 0]));
  const meals = asks.filter((a) => a.kind === "meals").reduce((t, a) => t + a.qty, 0);
  const ordered = [...s.rising, ...s.rows.filter((r) => r.changePct === null)];
  const siteName = (id: string | null) => (id ? SITES.find((x) => x.id === id)?.name ?? id : "No listed place fit");
  const siteMax = Math.max(1, ...s.sites.map((x) => x.count ?? 0));

  // The demand forecast, drawn as a line beside the needs.
  const people = nights.map((n) => expectedPeople(n.prediction));
  const cap = nights[0].prediction.capacity;
  const W = 420, H = 150, lo = Math.min(60, ...people) - 6, hi = Math.max(cap + 10, ...people) + 6;
  const x = (i: number) => 14 + (i / (nights.length - 1)) * (W - 28);
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const path = people.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <>
      <Nav active="/insights" scenario={scenario} source={source} />
      <main className="mx-auto max-w-[1320px] px-4 pt-6 pb-20 sm:px-8">
        <h1 className="rise text-[40px] leading-[1.02] sm:text-[56px]">What people are asking for</h1>
        <p className="rise mt-3 max-w-[700px] text-[17px] leading-relaxed text-ink/85" style={{ ["--d" as string]: "80ms" }}>
          Counts of the needs volunteers confirmed at intake, by day and by need, with the demand forecast beside them. Totals only: no record of any one person can be opened here, because none is kept.
        </p>
        <p className="rise mt-4 inline-block rounded-lg bg-warm-soft px-3.5 py-2 text-[15px] text-warm-ink" style={{ ["--d" as string]: "120ms" }}>
          <strong className="font-semibold">SIMULATED intake history.</strong> The last {HISTORY_DAYS} days are generated with a fixed seed ({INTAKE_SEED}). Only today&rsquo;s column is real, from routings done in this app.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="card rise p-5 sm:p-6" style={{ ["--d" as string]: "160ms" }} aria-labelledby="rising-h">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="rising-h" className="text-lg font-semibold">Rising needs, week over week</h2>
              <p className="tnum text-sm text-muted">{s.intakes.thisWeek} intakes this week · {s.intakes.lastWeek} last week · SIMULATED</p>
            </div>
            <ul className="mt-2 divide-y divide-line/70">
              {ordered.map((r, i) => (
                <li key={r.need} className="rise grid gap-x-6 gap-y-2 py-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" style={{ ["--d" as string]: `${220 + i * 60}ms` }}>
                  <div>
                    <p className="flex flex-wrap items-center gap-2.5"><span className="text-[17px] font-semibold">{r.label}</span><Change pct={r.changePct} /></p>
                    <p className="mt-1.5 text-[14px] leading-snug text-muted">{forecastLine(r.need, nights, meals)}</p>
                  </div>
                  <WeekBars row={r} max={max} i={i} />
                </li>
              ))}
            </ul>
          </section>

          <section className="card rise flex flex-col p-5 sm:p-6" style={{ ["--d" as string]: "220ms" }} aria-labelledby="fc-h">
            <h2 id="fc-h" className="text-lg font-semibold">The demand forecast beside it</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-ink/85">People expected to need a bed at Firehouse, next {nights.length} nights{scenario ? " (scenario)" : ""}.</p>
            <svg viewBox={`0 0 ${W} ${H + 26}`} className="mt-4 h-auto w-full" role="img" aria-label={`Predicted people per night: ${people.join(", ")}. Capacity ${cap}.`}>
              <line x1="0" x2={W} y1={y(cap)} y2={y(cap)} stroke="var(--text)" strokeOpacity="0.35" strokeDasharray="5 5" />
              <text x={W} y={y(cap) - 6} textAnchor="end" fontSize="12" fill="var(--muted)">{cap} beds</text>
              <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" pathLength={1200} className="draw" />
              {people.map((v, i) => (
                <g key={i}>
                  <circle cx={x(i)} cy={y(v)} r="4" fill={v > cap ? "var(--negative)" : "var(--accent)"} stroke="var(--surface)" strokeWidth="2" />
                  <text x={x(i)} y={y(v) - 10} textAnchor="middle" fontSize="13" fontWeight="600" fill={v > cap ? "var(--negative)" : "var(--accent-ink)"} style={{ fontVariantNumeric: "tabular-nums" }}>{v}</text>
                  <text x={x(i)} y={H + 20} textAnchor="middle" fontSize="12" fill="var(--muted)">{i === 0 ? "Ton" : wd(nights[i].day.date)}</text>
                </g>
              ))}
            </svg>
            <ul className="tnum mt-3 flex justify-between gap-1 text-xs">
              {nights.map((n) => <li key={n.day.date} className={`flex-1 text-center ${(n.day.lowF ?? 99) <= 32 ? "font-semibold text-negative" : (n.day.lowF ?? 99) < 40 ? "font-semibold text-warm-ink" : "text-muted"}`}>{n.day.lowF}°</li>)}
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-muted">The line is the model&rsquo;s forecast (trained on SIMULATED history); the row under it is each night&rsquo;s forecast low. Needs are what people told volunteers; the forecast is what the weather implies. Read them together.</p>
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <Link href={`/asks${q}`} className="press flex min-h-11 items-center rounded-full bg-accent px-5 text-[15px] font-semibold text-white hover:bg-accent-ink">Turn it into asks</Link>
              <Link href={`/forecast${q}`} className="press flex min-h-11 items-center rounded-full bg-raised px-5 text-[15px] font-medium hover:bg-accent-track">Open the forecast</Link>
            </div>
          </section>
        </div>

        <section className="card rise mt-6 p-5 sm:p-6" style={{ ["--d" as string]: "280ms" }} aria-labelledby="daily-h">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="daily-h" className="text-lg font-semibold">Each need, day by day</h2>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              <span className="flex items-center gap-1.5"><i className="h-3 w-2 rounded-[2px] bg-accent-track" />Last week</span>
              <span className="flex items-center gap-1.5"><i className="h-3 w-2 rounded-[2px] bg-accent" />This week</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2.5 rounded-[2px] border border-dashed border-muted/70" />Fewer than {SUPPRESS_BELOW}, not shown</span>
            </p>
          </div>
          <p className="tnum mt-1 text-sm text-muted">{md(s.days[0])} to {md(s.days[s.days.length - 1])}, SIMULATED. The figure at the right of each strip is today, real.</p>
          <div className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {s.rows.map((r) => (
              <div key={r.need}>
                <p className="flex items-baseline justify-between gap-2"><span className="font-semibold">{r.label}</span><span className="tnum text-sm text-muted">{cell(r.thisWeek)} this week</span></p>
                <div className="mt-2"><DayStrip row={r} days={s.days} /></div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="card rise p-5 sm:p-6" style={{ ["--d" as string]: "320ms" }} aria-labelledby="where-h">
            <h2 id="where-h" className="text-lg font-semibold">Where routing pointed, this week</h2>
            <p className="mt-1 text-sm text-muted">The top-ranked place for each intake. SIMULATED.</p>
            <ul className="mt-4 grid gap-3">
              {s.sites.map((x, i) => (
                <li key={String(x.id)} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                  <span className="truncate text-[15px] font-medium">{siteName(x.id)}</span>
                  <span className="tnum text-[15px] font-semibold">{cell(x.count)}</span>
                  <span className="col-span-2 block h-2.5 overflow-hidden rounded-full bg-raised">
                    {x.count !== null && <span className="grow-x block h-full rounded-full bg-accent" style={{ width: `${(x.count / siteMax) * 100}%`, animationDelay: `${300 + i * 80}ms` }} />}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rise rounded-xl bg-raised p-5 sm:p-6" style={{ ["--d" as string]: "360ms" }} aria-labelledby="keep-h">
            <h2 id="keep-h" className="text-lg font-semibold">What is kept, and what is not</h2>
            <ul className="mt-3 grid gap-2.5 text-[15px] leading-relaxed text-ink/85">
              <li><strong className="font-semibold text-ink">Kept per routing:</strong> the date, the need tags the volunteer confirmed, and the id of the top-ranked place.</li>
              <li><strong className="font-semibold text-ink">Never kept:</strong> the note, age, gender, a name, a phone number, a device id or the time of day.</li>
              <li><strong className="font-semibold text-ink">Small-cell suppression:</strong> any group with fewer than {SUPPRESS_BELOW} intakes shows as &ldquo;&lt;{SUPPRESS_BELOW}&rdquo;, and its change is not calculated. The exact number never reaches the browser.</li>
              <li><strong className="font-semibold text-ink">Today so far:</strong> <span className="tnum">{todayEvents.length}</span> routing{todayEvents.length === 1 ? "" : "s"} recorded by this app, a running total with no breakdown.</li>
            </ul>
            <Link href={`/route${q}`} className="press mt-4 inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-[15px] font-semibold text-white hover:bg-accent-ink">Route a person</Link>
          </section>
        </div>
      </main>
    </>
  );
}
