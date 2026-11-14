import Nav from "@/components/Nav";
import { COEFFICIENTS, HOLDOUT, MODEL, BAND_Z } from "@/lib/model/forecast";
import { CAPACITY, SEED, TARGET_MEAN } from "@/lib/model/simulate";
import { getForecast } from "@/lib/weather/nws";
import { ASK_FORMULAS } from "@/lib/asks";
import { HISTORY_DAYS, INTAKE_SEED, SUPPRESS_BELOW } from "@/lib/insights";

export const dynamic = "force-dynamic";

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Last 60 simulated nights: what happened vs what the model said, drawn as two lines. */
function Backtest() {
  const bt = MODEL.backtest;
  const W = 900, H = 220, lo = Math.min(...bt.map((b) => Math.min(b.actual, b.predicted))) - 4, hi = CAPACITY + 2;
  const x = (i: number) => (i / (bt.length - 1)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const path = (k: "actual" | "predicted") => bt.map((b, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(b[k]).toFixed(1)}`).join(" ");
  return (
    <figure className="card rise p-5 sm:p-6" style={{ ["--d" as string]: "160ms" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Backtest: the last {HOLDOUT} nights, held out</h2>
        <div className="flex gap-4 text-sm text-muted">
          <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-ink/40" />Simulated actual</span>
          <span className="flex items-center gap-1.5"><i className="h-1 w-4 rounded bg-accent" />Model</span>
        </div>
      </div>
      <p className="mt-1 text-[15px] text-ink/80">
        Mean absolute error <strong className="tnum text-accent-ink">{r1(MODEL.mae)} people per night</strong> on nights the model never saw. Both lines are SIMULATED data.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-auto w-full" role="img" aria-label={`Backtest over ${HOLDOUT} nights, mean absolute error ${r1(MODEL.mae)}`}>
        <line x1="0" x2={W} y1={y(CAPACITY)} y2={y(CAPACITY)} stroke="var(--text)" strokeOpacity="0.35" strokeDasharray="5 5" />
        <text x={W} y={y(CAPACITY) - 6} textAnchor="end" fontSize="12" fill="var(--muted)">100 beds</text>
        <path d={path("actual")} fill="none" stroke="var(--text)" strokeOpacity="0.4" strokeWidth="1.5" pathLength={1200} className="draw" />
        <path d={path("predicted")} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" pathLength={1200} className="draw" style={{ ["--d" as string]: "500ms" }} />
      </svg>
      <figcaption className="mt-2 flex justify-between text-xs text-muted tnum">
        <span>{bt[0].date}</span>
        <span>{bt[bt.length - 1].date}</span>
      </figcaption>
    </figure>
  );
}

export default async function About({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const scenario = (await searchParams).scenario === "arctic";
  const { source } = await getForecast();
  const c = COEFFICIENTS;
  const symbols = [
    ["B̂", "Predicted people needing a bed at Firehouse that night."],
    ["β₀", "Baseline demand on a mild, ordinary weeknight."],
    ["C", "Cold severity = max(0, 50 − T), where T is the forecast low in °F. A 30°F night gives C = 20."],
    ["P", "Chance of precipitation, 0 to 1, from the NWS forecast."],
    ["W", "1 on a Saturday or Sunday night, else 0."],
    ["H", "1 on a federal holiday (and Dec 24, Dec 31), else 0."],
    ["M", "1 on the first 3 days of the month, else 0 (benefit and paycheck timing)."],
    ["β₁ … β₅", "Weights fitted by ordinary least squares on the simulated history."],
  ];
  const plain = [
    { k: "C", v: c.C, text: `Each °F colder below 50°F adds about ${r1(c.C)} people.` },
    { k: "P", v: c.P, text: `A certain-rain night adds about ${r1(c.P)} people over a dry one.` },
    { k: "W", v: c.W, text: `Weekend nights run about ${r1(Math.abs(c.W))} ${c.W < 0 ? "fewer" : "more"} people.` },
    { k: "H", v: c.H, text: `Holidays add about ${r1(c.H)} people.` },
    { k: "M", v: c.M, text: `The first 3 days of the month ${c.M >= 0 ? "add" : "remove"} about ${r1(Math.abs(c.M))} people.` },
  ];
  const real = [
    ["Weather forecast and alerts", "Real", "Live from api.weather.gov, cached 10 minutes, saved snapshot when offline."],
    ["Activation rules", "Real policy + one assumption", "Firehouse 40°F / Heat Advisory rule is published. Warming station at ≤ 32°F is our assumption from news coverage."],
    ["Firehouse capacity (100)", "Real", "firehouseshelter.com."],
    ["Annual totals (29,509 nights, 92,693 meals; 911 counted)", "Real", "Firehouse 2025; 2024 point-in-time count."],
    ["Nightly occupancy history", "SIMULATED", `Two years, seed ${SEED}, calibrated to a mean of ${r1(TARGET_MEAN)} a night (29,509 ÷ 365).`],
    ["Model weights and backtest error", "Fitted on SIMULATED data", "They show the method works; real accuracy needs Firehouse's nightly counts."],
    ["Other sites' capacity and hours", "Unknown", "Stored as null and shown as “unverified — call”."],
    ["Asks multipliers (blankets, water, volunteers, meals)", "Assumption", "Our starting ratios. Shown on the needs board as “assumption — confirm with shelter staff”."],
    ["Alert lead times", "Assumption", "Donors two days ahead, volunteers the day before at noon, staff and warming stations the evening before."],
    ["Intake history on the insights page", "SIMULATED", `${HISTORY_DAYS} days, seed ${INTAKE_SEED}, with warmth made to rise. It shows the method, not Birmingham's real needs.`],
    ["Routings recorded today", "Real", "One aggregate line per routing done in this app: date, confirmed need tags, top site id."],
    ["Outreach reports marked SAMPLE", "SAMPLE", "Demo data at public landmarks, drawn in orange on the map."],
  ];

  return (
    <>
      <Nav active="/about" scenario={scenario} source={source} />
      <main className="mx-auto max-w-[1080px] px-4 pt-6 pb-20 sm:px-8">
        <h1 className="rise text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[48px]">How the forecast works</h1>
        <p className="rise mt-3 max-w-[680px] text-[18px] leading-relaxed text-ink/85" style={{ ["--d" as string]: "80ms" }}>
          We predict how many people will need a bed at one shelter on one night. Never anything about a person. Rules the shelters already use always win over the model. Asks, alerts and insights are built on top of that forecast.
        </p>

        <section className="card rise mt-8 p-5 sm:p-7" style={{ ["--d" as string]: "120ms" }} aria-labelledby="f-h">
          <h2 id="f-h" className="text-lg font-semibold">The formula</h2>
          <p className="mt-4 overflow-x-auto text-[26px] font-medium tracking-[-0.01em] text-accent-ink sm:text-[32px]">
            B̂ = β₀ + β₁·C + β₂·P + β₃·W + β₄·H + β₅·M
          </p>
          <dl className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {symbols.map(([s, d]) => (
              <div key={s} className="flex gap-3">
                <dt className="w-16 shrink-0 text-[17px] font-semibold text-accent-ink">{s}</dt>
                <dd className="text-[15px] leading-relaxed text-ink/85">{d}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 rounded-lg bg-raised p-4 text-[15px] leading-relaxed">
            Predictions are clipped to 0–{CAPACITY}. Anything above capacity is reported as <strong>spill = max(0, B̂ − {CAPACITY})</strong>.
            The range is B̂ ± {BAND_Z} × residual standard deviation ({r1(MODEL.fit.residualSD)} people), about an 80% band.
          </p>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <section className="card rise p-5 sm:p-6" style={{ ["--d" as string]: "140ms" }} aria-labelledby="coef-h">
            <h2 id="coef-h" className="text-lg font-semibold">Fitted weights, in plain English</h2>
            <p className="tnum mt-2 text-[15px] text-ink/80">Baseline β₀ ≈ {r1(c.intercept)} people on a mild weeknight.</p>
            <ul className="mt-4 grid gap-3">
              {plain.map((p, i) => (
                <li key={p.k} className="rise flex items-start gap-3" style={{ ["--d" as string]: `${240 + i * 70}ms` }}>
                  <span className="tnum w-14 shrink-0 rounded-md bg-accent-soft py-0.5 text-center text-sm font-semibold text-accent-ink">{p.v >= 0 ? "+" : ""}{r1(p.v)}</span>
                  <span className="text-[15px] leading-relaxed">{p.text}</span>
                </li>
              ))}
            </ul>
          </section>
          <Backtest />
        </div>

        <section className="card rise mt-6 p-5 sm:p-6" style={{ ["--d" as string]: "180ms" }} aria-labelledby="rs-h">
          <h2 id="rs-h" className="text-lg font-semibold">What is real and what is simulated</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[620px] text-[15px]">
              <thead className="text-left text-sm text-muted">
                <tr className="border-b border-line"><th className="py-2 font-medium">Data</th><th className="py-2 font-medium">Status</th><th className="py-2 font-medium">Where it comes from</th></tr>
              </thead>
              <tbody>
                {real.map(([a, b, d]) => (
                  <tr key={a} className="border-b border-line/60 align-top last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{a}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`rounded-md px-2 py-0.5 text-sm font-medium ${b.startsWith("Real") ? "bg-positive-soft text-positive" : b === "Unknown" ? "bg-raised text-muted" : "bg-warm-soft text-warm-ink"}`}>{b}</span>
                    </td>
                    <td className="py-2.5 text-ink/80">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card rise mt-6 p-5 sm:p-6" style={{ ["--d" as string]: "190ms" }} aria-labelledby="hub-h">
          <h2 id="hub-h" className="text-lg font-semibold">The coordination hub: asks, alerts and insights</h2>
          <p className="mt-2 max-w-[760px] text-[15px] leading-relaxed text-ink/85">
            Tonight BHM is a coordination layer, not a replacement. One Roof Coordinated Entry stays the housing path; findhelp and 2-1-1 stay the program directory. The hub adds foresight and action before the cold night. AI does one job here: turning an intake note into need tags a volunteer confirms. Asks and alerts are formulas and rules.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-raised p-4">
              <h3 className="font-semibold">Asks multipliers</h3>
              <ul className="tnum mt-2 grid gap-1 text-[15px] text-ink/85">
                <li>Blankets = people × {ASK_FORMULAS.blanketsPerPerson}, on nights below {ASK_FORMULAS.blanketBelowF}°F</li>
                <li>Water = people × {ASK_FORMULAS.waterPerPerson}, on Heat Advisory days</li>
                <li>Volunteers = people ÷ {ASK_FORMULAS.peoplePerVolunteer}, rounded up</li>
                <li>Meals = people × {ASK_FORMULAS.mealsPerPerson}</li>
              </ul>
              <p className="mt-2 text-sm text-warm-ink">Assumptions — confirm with shelter staff. 100 people on a cold night gives 150 blankets and 4 volunteers.</p>
            </div>
            <div className="rounded-lg bg-raised p-4">
              <h3 className="font-semibold">Small-cell suppression</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink/85">On the insights page, any group with fewer than {SUPPRESS_BELOW} intakes is shown as “&lt;{SUPPRESS_BELOW}” and its week-over-week change is not calculated, so a small count can never point at a person. The exact number is removed on the server.</p>
            </div>
            <div className="rounded-lg bg-raised p-4">
              <h3 className="font-semibold">Who is notified, and who is not</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink/85">Alerts go to shelter staff, warming-station operators, volunteers and donors. Nobody experiencing homelessness is notified from a stored number, because none is stored. Sending is in-app only; SMS is not connected.</p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="card rise p-5 sm:p-6" style={{ ["--d" as string]: "200ms" }}>
            <h2 className="text-lg font-semibold">Why simulated, and how</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink/85">
              No public daily shelter counts exist for Birmingham. We generated two years of nights with a fixed seed: a Birmingham seasonal low (about 35°F in January, 72°F in July) plus daily noise; demand rises on colder and wetter nights, dips on weekends, and shifts on holidays and at the start of the month, the directions found in Calgary shelter data (Jadidzadeh &amp; Kneebone, 2015). Nights are capped at 100 beds. Swap in Firehouse&apos;s real nightly counts and the same code refits.
            </p>
          </div>
          <div className="card rise p-5 sm:p-6" style={{ ["--d" as string]: "240ms" }}>
            <h2 className="text-lg font-semibold">Sources</h2>
            <ul className="mt-2 grid gap-1.5 text-[15px]">
              {[
                ["National Weather Service API", "https://api.weather.gov"],
                ["Firehouse emergency shelter", "https://firehouseshelter.com/the-emergency-shelter-operation/"],
                ["Firehouse day shelter", "https://firehouseshelter.com/?p=14"],
                ["Birmingham Watch: warming stations", "https://birminghamwatch.org/2026/01/30/warming-stations-open-as-birmingham-settles-in-for-a-deep-freeze/"],
                ["Jadidzadeh & Kneebone (2015), Calgary shelter use", "https://scholar.google.com/scholar?q=Jadidzadeh+Kneebone+2015+Calgary+shelter+weather"],
              ].map(([t, u]) => (
                <li key={u}><a href={u} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2 hover:text-accent-ink">{t}</a></li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
