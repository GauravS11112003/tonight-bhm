import { ARENA, GBM_FEATURES, HOLDOUT, MODEL_NAME, dependence, learningCurve, type ModelId } from "@/lib/model/forecast";

const r1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/** Two-line SVG chart, drawn on entry. Real computed points only. */
function Lines({ xs, a, b, xLabel, yLabel, fmtX }: { xs: number[]; a: number[]; b: number[]; xLabel: string; yLabel: string; fmtX: (x: number) => string }) {
  const W = 520, H = 200, P = 28;
  const all = [...a, ...b];
  const lo = Math.floor(Math.min(...all) - 1), hi = Math.ceil(Math.max(...all) + 1);
  const x = (i: number) => P + (i / (xs.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const path = (v: number[]) => v.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${yLabel} by ${xLabel}`}>
      {[lo, (lo + hi) / 2, hi].map((v) => (
        <g key={v}>
          <line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="var(--border)" />
          <text x={P - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{Math.round(v)}</text>
        </g>
      ))}
      {xs.map((v, i) => <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{fmtX(v)}</text>)}
      <path d={path(a)} fill="none" stroke="var(--text)" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="5 5" pathLength={1200} className="draw" />
      <path d={path(b)} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" pathLength={1200} className="draw" style={{ ["--d" as string]: "450ms" }} />
      {b.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="var(--accent)" className="rise" style={{ ["--d" as string]: `${700 + i * 80}ms` }} />)}
    </svg>
  );
}

const Legend = () => (
  <div className="flex flex-wrap gap-4 text-sm text-muted">
    <span className="flex items-center gap-1.5"><i className="w-5 border-t-2 border-dashed border-ink/50" />{MODEL_NAME.ols}</span>
    <span className="flex items-center gap-1.5"><i className="h-[3px] w-5 rounded bg-accent" />{MODEL_NAME.gbm}</span>
  </div>
);

export default function ModelArena() {
  const champ = ARENA.champion;
  const curve = learningCurve();
  const dep = dependence(10, 60, 5);
  const cross = curve.find((c) => c.gbm < c.ols);
  const imp = GBM_FEATURES.map((name, i) => ({ name, v: ARENA.gbm.importance[i] })).sort((a, b) => b.v - a.v);

  return (
    <section className="mt-10" aria-labelledby="arena-h">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="arena-h" className="display text-[44px] leading-none sm:text-[56px]">Two models, one honest scoreboard</h2>
          <p className="mt-3 max-w-[720px] text-[17px] leading-relaxed text-ink/85">
            A linear model and a gradient-boosted tree model, both written by hand, compete on {HOLDOUT} nights neither has seen. The lower error drives every forecast on this site. Rules still override both. All data here is <strong>SIMULATED</strong>.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {(["ols", "gbm"] as ModelId[]).map((m, i) => {
          const r = ARENA.results[m];
          const won = m === champ;
          return (
            <article key={m} className={`card rise p-6 ${won ? "ring-2 ring-accent" : ""}`} style={{ ["--d" as string]: `${i * 90}ms` }}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{MODEL_NAME[m]}</h3>
                {won && <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold text-white">Champion</span>}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <div><dd className="display tnum text-[52px] leading-none">{r1(r.mae)}</dd><dt className="label mt-1">people off per night, on average</dt></div>
                <div><dd className="display tnum text-[52px] leading-none">{r1(r.freezeMae)}</dd><dt className="label mt-1">off on the {r.freezeNights} freezing nights</dt></div>
              </dl>
              <p className="mt-4 text-[15px] text-ink/80">
                {m === "ols" ? "Five inputs, one weight each. Easy to explain; cannot bend at freezing or count a cold spell." : `${ARENA.gbm.trees} small trees, each fixing the last ones' mistakes. Constrained so colder, wetter or a longer cold spell never means fewer people.`}
              </p>
            </article>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <figure className="card rise p-6" style={{ ["--d" as string]: "150ms" }}>
          <h3 className="text-lg font-semibold">The moat is the data</h3>
          <p className="mt-1 text-[15px] text-ink/80">
            Error on held-out nights as each model sees more nights of history. With little data the trees lose{cross ? `; from about ${cross.nights} nights they pull ahead` : ""}. Every real nightly count Firehouse logs moves us right on this chart.
          </p>
          <div className="mt-3"><Legend /></div>
          <Lines xs={curve.map((c) => c.nights)} a={curve.map((c) => c.ols)} b={curve.map((c) => c.gbm)} xLabel="nights of training data" yLabel="people off per night" fmtX={(v) => `${v}`} />
          <figcaption className="text-xs text-muted">Nights of training data → average error (people). Six years of SIMULATED history.</figcaption>
        </figure>

        <figure className="card rise p-6" style={{ ["--d" as string]: "220ms" }}>
          <h3 className="text-lg font-semibold">What drives demand, per the trees</h3>
          <ul className="mt-4 grid gap-3">
            {imp.map((f, i) => (
              <li key={f.name}>
                <div className="flex justify-between text-[15px]"><span>{f.name}</span><span className="tnum text-muted">{Math.round(f.v * 100)}%</span></div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-accent-track">
                  <div className="grow-x h-full rounded-full bg-accent" style={{ width: `${Math.max(1, f.v * 100)}%`, animationDelay: `${300 + i * 80}ms` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">Share of error reduction credited to each input.</p>
        </figure>
      </div>

      <figure className="card rise mt-4 p-6" style={{ ["--d" as string]: "260ms" }}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-lg font-semibold">How each model reacts to the cold</h3>
          <Legend />
        </div>
        <p className="mt-1 text-[15px] text-ink/80">
          Predicted people needing a bed on an ordinary weeknight, by overnight low. The straight line keeps climbing; the trees learn the jump at freezing but cannot go past the coldest nights they have seen, so below about 20°F they flatten. That is why the 32°F rule, not the model, decides warming stations.
        </p>
        <Lines xs={dep.map((d) => d.lowF)} a={dep.map((d) => d.ols)} b={dep.map((d) => d.gbm)} xLabel="overnight low °F" yLabel="predicted people" fmtX={(v) => `${v}°`} />
      </figure>
    </section>
  );
}
