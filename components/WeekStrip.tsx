import type { Night } from "@/lib/plan";
import { RULES } from "@/lib/rules/engine";

const MAX = 125; // chart top in people; capacity 100 sits at 80% so spill has room
const H = 168; // bar area height, px

function dayLabel(date: string, i: number) {
  if (i === 0) return "Tonight";
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}
const dateLabel = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** The overnight lows as a line, with the two rule thresholds the city and Firehouse use. */
function LowsLine({ nights }: { nights: Night[] }) {
  const lows = nights.map((n) => n.day.lowF ?? 50);
  const lo = Math.min(20, ...lows) - 2, hi = Math.max(60, ...lows) + 2;
  const y = (t: number) => 100 - ((t - lo) / (hi - lo)) * 100;
  const x = (i: number) => ((i + 0.5) / nights.length) * 100;
  const d = lows.map((t, i) => `${i ? "L" : "M"}${x(i)},${y(t)}`).join(" ");
  return (
    <div className="relative h-[92px]">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <line x1="0" x2="100" y1={y(40)} y2={y(40)} stroke="var(--warm)" strokeOpacity="0.45" strokeDasharray="1.2 1.2" vectorEffect="non-scaling-stroke" />
        <line x1="0" x2="100" y1={y(32)} y2={y(32)} stroke="var(--negative)" strokeOpacity="0.45" strokeDasharray="1.2 1.2" vectorEffect="non-scaling-stroke" />
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.25" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pathLength={1200} className="draw" />
      </svg>
      {lows.map((t, i) => (
        <span
          key={i}
          className="rise tnum absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface px-1.5 text-[13px] font-semibold"
          style={{ left: `${x(i)}%`, top: `${y(t)}%`, ["--d" as string]: `${300 + i * 90}ms`, color: t <= 32 ? "var(--negative)" : t < 40 ? "var(--warm-ink)" : "var(--accent-ink)" }}
        >
          {t}°
        </span>
      ))}
    </div>
  );
}

export default function WeekStrip({ nights }: { nights: Night[] }) {
  const capTop = H - (100 / MAX) * H;
  return (
    <section className="card rise p-5 sm:p-6" style={{ ["--d" as string]: "120ms" }} aria-labelledby="week-h">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="week-h" className="text-lg font-semibold">Next 7 nights at Firehouse</h2>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
          <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 bg-accent" />Overnight low</span>
          <span className="flex items-center gap-1.5"><i className="inline-block w-4 border-t-2 border-dashed border-warm" />40°F Firehouse rule</span>
          <span className="flex items-center gap-1.5"><i className="inline-block w-4 border-t-2 border-dashed border-negative" />32°F warming stations</span>
          <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-accent" />Predicted guests</span>
          <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-accent-track" />80% range</span>
          <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-negative" />Over capacity</span>
          <span className="rounded-full bg-raised px-2 py-0.5 text-xs font-medium text-ink">Model trained on SIMULATED history</span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[640px]">
          <LowsLine nights={nights} />
          <div className="mt-3 grid grid-cols-7 gap-2 sm:gap-3">
            {nights.map((n, i) => {
              const p = n.prediction;
              const px = (v: number) => (Math.min(v, MAX) / MAX) * H;
              const fired = n.results.filter((r) => r.fired);
              return (
                <div key={n.day.date} className={`rounded-lg p-2.5 sm:p-3 ${i === 0 ? "bg-accent-soft" : "bg-raised/60"}`}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{dayLabel(n.day.date, i)}</span>
                    <span className="text-xs text-muted">{dateLabel(n.day.date)}</span>
                  </div>
                  <p className="tnum mt-1 text-sm text-muted">
                    <span className="text-ink">{n.day.lowF ?? "–"}°</span> / {n.day.highF ?? "–"}° · {Math.round(n.day.precipProb * 100)}% rain
                  </p>

                  {/* Bar: predicted occupancy, its range, the capacity line and any spill. */}
                  <div className="relative mt-3" style={{ height: H }} role="img" aria-label={`${Math.round(p.predicted)} of 100 beds predicted, range ${Math.round(p.low)} to ${Math.round(p.high)}${p.spill > 0 ? `, ${Math.round(p.spill)} over capacity` : ""}`}>
                    <div className="absolute inset-x-[22%] bottom-0 rounded-t-md bg-accent-track grow" style={{ height: px(p.high), ["--d" as string]: `${200 + i * 70}ms` }} />
                    <div className="absolute inset-x-[34%] bottom-0 rounded-t-md bg-accent grow" style={{ height: px(p.predicted), ["--d" as string]: `${260 + i * 70}ms` }} />
                    {p.spill > 0 && (
                      <div className="absolute inset-x-[34%] rounded-t-md bg-negative grow" style={{ bottom: px(100), height: px(p.spill), ["--d" as string]: `${900 + i * 70}ms` }} />
                    )}
                    <div className="absolute inset-x-0 border-t-2 border-dashed border-ink/50" style={{ top: capTop }} />
                    {i === 0 && <span className="absolute -top-0.5 left-0 text-[11px] text-muted" style={{ top: capTop - 16 }}>100 beds</span>}
                    <span className="tnum absolute inset-x-0 text-center text-[15px] font-semibold" style={{ bottom: px(Math.max(p.high, p.predicted + p.spill)) + 4 }}>
                      {Math.round(p.predicted)}
                    </span>
                  </div>
                  <p className="tnum mt-1.5 text-center text-xs text-muted">{Math.round(p.low)}–{Math.round(p.high)}{p.spill > 0 ? ` · +${Math.round(p.spill)} spill` : ""}</p>

                  <div className="mt-2.5 flex min-h-[52px] flex-col gap-1">
                    {n.day.alerts.map((a) => (
                      <span key={a} className="rounded-md bg-negative-soft px-1.5 py-0.5 text-[11px] font-medium leading-tight text-negative">{a}</span>
                    ))}
                    {fired.map((r) => {
                      const rule = RULES.find((x) => x.id === r.ruleId)!;
                      return (
                        <span key={r.ruleId} title={r.reason} className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight ${rule.kind === "assumption" ? "bg-warm text-white" : "bg-warm-soft text-warm-ink"}`}>
                          {rule.short}
                        </span>
                      );
                    })}
                    {!fired.length && !n.day.alerts.length && <span className="text-[11px] text-muted">No activations</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
