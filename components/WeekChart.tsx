import type { Night } from "@/lib/plan";
import { RULES } from "@/lib/rules/engine";
import { MODEL_NAME } from "@/lib/model/forecast";

const LO = 60, HI = 120; // people; capacity 100 sits high enough that spill has room
const y = (v: number) => 100 - ((Math.min(HI, Math.max(LO, v)) - LO) / (HI - LO)) * 100; // % from top
const dayName = (date: string, i: number) => (i === 0 ? "Tonight" : new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }));
const dateLabel = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const tempColor = (t: number | null) => ((t ?? 99) <= 32 ? "var(--negative)" : (t ?? 99) < 40 ? "var(--warm-ink)" : "var(--accent-ink)");

/** One sentence that says what the week holds, built from the same numbers as the chart. */
function summary(nights: Night[]) {
  const peak = nights.reduce((a, b) => (b.prediction.raw > a.prediction.raw ? b : a));
  const fired = nights.filter((n) => n.results.some((r) => r.fired)).length;
  const spill = nights.filter((n) => n.prediction.spill >= 1).length;
  const peakName = peak === nights[0] ? "tonight" : new Date(peak.day.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  return `Busiest night is ${peakName}, about ${Math.round(peak.prediction.raw)} people. ${fired ? `Activation rules fire on ${fired} of 7 nights` : "No activation rules fire this week"}${spill ? `, and ${spill} night${spill > 1 ? "s" : ""} run over capacity.` : "."}`;
}

export default function WeekChart({ nights }: { nights: Night[] }) {
  const n = nights.length;
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const pts = (f: (k: Night) => number) => nights.map((k, i) => `${x(i)},${y(f(k))}`).join(" ");
  const band = `${pts((k) => k.prediction.high)} ${[...nights].reverse().map((k, j) => `${x(n - 1 - j)},${y(k.prediction.low)}`).join(" ")}`;
  const champ = nights[0].prediction.model ?? "ols";

  return (
    <section className="mt-8" aria-labelledby="week-h">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="week-h" className="display rise text-[44px] leading-none sm:text-[56px]">The week ahead</h2>
          <p className="rise mt-3 max-w-[680px] text-[17px] leading-relaxed text-ink/85" style={{ ["--d" as string]: "80ms" }}>{summary(nights)}</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted">
          <span className="flex items-center gap-1.5"><i className="h-[3px] w-5 rounded bg-accent" />{MODEL_NAME[champ]} (champion)</span>
          <span className="flex items-center gap-1.5"><i className="w-5 border-t-2 border-dashed border-ink/40" />{MODEL_NAME[champ === "gbm" ? "ols" : "gbm"]}</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-5 rounded-sm bg-accent-track" />80% range</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-5 rounded-sm bg-negative/70" />Over 100 beds</span>
        </div>
      </div>

      <div className="card rise mt-6 overflow-x-auto p-4 sm:p-6" style={{ ["--d" as string]: "140ms" }}>
        <div className="min-w-[700px]">
          {/* Weather row */}
          <div className="grid grid-cols-7">
            {nights.map((k, i) => (
              <div key={k.day.date} className={`rounded-t-2xl px-3 pt-3 pb-2 ${i === 0 ? "bg-accent-soft" : ""}`}>
                <p className="flex items-baseline justify-between text-sm"><span className="font-semibold">{dayName(k.day.date, i)}</span><span className="text-muted">{dateLabel(k.day.date)}</span></p>
                <p className="display tnum mt-1 text-[52px] leading-none" style={{ color: tempColor(k.day.lowF) }}>{k.day.lowF ?? "–"}°</p>
                <p className="tnum mt-1 text-xs text-muted">high {k.day.highF ?? "–"}° · {Math.round(k.day.precipProb * 100)}% rain</p>
              </div>
            ))}
          </div>

          {/* Demand chart: one continuous line across the week */}
          <div className="relative h-[240px]">
            <div className="absolute inset-0 grid grid-cols-7">
              {nights.map((k, i) => <div key={k.day.date} className={i === 0 ? "bg-accent-soft" : i % 2 ? "bg-raised/40" : ""} />)}
            </div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img"
              aria-label={`Predicted people at Firehouse each night: ${nights.map((k) => Math.round(k.prediction.raw)).join(", ")}. Capacity 100.`}>
              <polygon points={band} fill="var(--accent-track)" opacity="0.75" className="rise" />
              {nights.map((k, i) => k.prediction.spill >= 1 && (
                <rect key={k.day.date} x={x(i) - 3} width="6" y={y(k.prediction.raw)} height={y(100) - y(k.prediction.raw)} fill="var(--negative)" opacity="0.7" rx="1" className="grow" />
              ))}
              <line x1="0" x2="100" y1={y(100)} y2={y(100)} stroke="var(--text)" strokeOpacity="0.55" strokeDasharray="1.2 1.2" vectorEffect="non-scaling-stroke" strokeWidth="1.5" />
              <polyline points={pts((k) => k.prediction.challenger ?? k.prediction.raw)} fill="none" stroke="var(--text)" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" className="rise" style={{ ["--d" as string]: "300ms" }} />
              <polyline points={pts((k) => k.prediction.raw)} fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="rise" style={{ ["--d" as string]: "450ms" }} />
            </svg>
            <span className="absolute left-2 text-xs font-medium text-ink/70" style={{ top: `calc(${y(100)}% - 18px)` }}>100 beds</span>
            {nights.map((k, i) => (
              <div key={k.day.date} className="rise absolute flex -translate-x-1/2 flex-col items-center" style={{ left: `${x(i)}%`, top: `calc(${y(k.prediction.raw)}% - 34px)`, ["--d" as string]: `${700 + i * 80}ms` }}>
                <span className={`tnum rounded-full px-2 py-0.5 text-[15px] font-semibold ${k.prediction.spill >= 1 ? "bg-negative text-white" : "bg-surface text-ink"}`}>{Math.round(k.prediction.raw)}</span>
                <span className="mt-1.5 size-3 rounded-full border-[3px] border-surface bg-accent" />
              </div>
            ))}
          </div>

          {/* Range and activation row */}
          <div className="grid grid-cols-7">
            {nights.map((k, i) => {
              const fired = k.results.filter((r) => r.fired);
              return (
                <div key={k.day.date} className={`flex min-h-[96px] flex-col gap-1 rounded-b-2xl px-3 pt-2 pb-3 ${i === 0 ? "bg-accent-soft" : ""}`}>
                  <p className="tnum text-xs text-muted">{Math.round(k.prediction.low)}–{Math.round(k.prediction.high)} likely</p>
                  {k.day.alerts.map((a) => <span key={a} className="rounded-md bg-negative-soft px-1.5 py-0.5 text-[11px] font-medium leading-tight text-negative">{a}</span>)}
                  {fired.map((r) => {
                    const rule = RULES.find((x) => x.id === r.ruleId)!;
                    return <span key={r.ruleId} title={r.reason} className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight ${rule.kind === "assumption" ? "bg-warm text-white" : "bg-warm-soft text-warm-ink"}`}>{rule.short}</span>;
                  })}
                  {!fired.length && !k.day.alerts.length && <span className="text-[11px] text-muted">Quiet night</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">Predicted people needing a bed at Firehouse, from a model trained on SIMULATED history. Rules fire from the weather alone and override the model.</p>
    </section>
  );
}
