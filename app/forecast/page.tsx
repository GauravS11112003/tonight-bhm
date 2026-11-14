import Link from "next/link";
import Nav from "@/components/Nav";
import WeekStrip from "@/components/WeekStrip";
import CountUp from "@/components/CountUp";
import LiveHero from "@/components/LiveHero";
import { buildWeek, type Night } from "@/lib/plan";
import { FORMULAS } from "@/lib/model/recommend";

// Reads the live forecast on each request (the weather client memoizes for 10 minutes).
export const dynamic = "force-dynamic";

const short = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

/** Collapse consecutive nights where a test holds into "Wed–Fri" style spans. */
function spans(nights: Night[], test: (n: Night) => boolean) {
  const out: Night[][] = [];
  let cur: Night[] = [];
  for (const n of nights) {
    if (test(n)) cur.push(n);
    else if (cur.length) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out;
}
const spanLabel = (s: Night[]) => (s.length === 1 ? short(s[0].day.date) : `${short(s[0].day.date)}–${short(s[s.length - 1].day.date)}`);

function Recommendations({ nights }: { nights: Night[] }) {
  const items: { tone: "warm" | "accent" | "negative"; title: string; body: string }[] = [];
  for (const s of spans(nights, (n) => n.plan.warming)) {
    const cost = s.length * FORMULAS.warmingStations * FORMULAS.warmingCostPerNight;
    items.push({
      tone: "warm",
      title: `${spanLabel(s)}: expect warming station activation`,
      body: `Lows of ${s.map((n) => `${n.day.lowF}°`).join(", ")}F. If both stations open, ${s.length} night${s.length > 1 ? "s" : ""} × 2 × $2,500 = $${cost.toLocaleString("en-US")}. The city decides per event.`,
    });
  }
  for (const s of spans(nights, (n) => n.prediction.high >= 90)) {
    const lo = Math.min(...s.map((n) => Math.round(n.prediction.low)));
    const hi = Math.max(...s.map((n) => Math.round(n.prediction.high)));
    const extra = Math.max(...s.map((n) => n.plan.extraVolunteers));
    const blankets = Math.max(...s.map((n) => n.plan.blankets));
    items.push({
      tone: "accent",
      title: `${spanLabel(s)}: Firehouse ${lo}–${hi} of 100`,
      body: `${extra > 0 ? `Add ${extra} volunteer${extra > 1 ? "s" : ""} per night` : "Usual staffing covers it"}${blankets ? `; stock about ${blankets} blankets` : ""}.`,
    });
  }
  for (const n of nights.filter((x) => x.prediction.spill >= 1)) {
    items.push({
      tone: "negative",
      title: `${short(n.day.date)}: about ${Math.round(n.prediction.spill)} more people than beds`,
      body: "Route overflow to an open warming station before Firehouse fills. Confirm the opening with the city first.",
    });
  }
  const extraDays = spans(nights, (n) => n.plan.dayShelterExtra);
  if (extraDays.length) {
    items.push({
      tone: "warm",
      title: `${extraDays.map(spanLabel).join(", ")}: day shelter rule fires`,
      body: "Firehouse opens the day shelter 2–5 p.m. on extra days when the low is below 40°F or there is a Heat Advisory.",
    });
  }
  if (!items.length) items.push({ tone: "accent", title: "A typical week", body: "No activation rules fire and Firehouse stays inside its usual range. Keep usual staffing." });

  const dot = { warm: "bg-warm", accent: "bg-accent", negative: "bg-negative" };
  return (
    <section className="card rise p-5 sm:p-6" style={{ ["--d" as string]: "200ms" }} aria-labelledby="rec-h">
      <h2 id="rec-h" className="text-lg font-semibold">What to prepare</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {items.slice(0, 6).map((it, i) => (
          <li key={i} className="rise flex gap-3" style={{ ["--d" as string]: `${300 + i * 80}ms` }}>
            <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${dot[it.tone]}`} />
            <div>
              <p className="font-semibold leading-snug">{it.title}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink/80">{it.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 overflow-x-auto">
        <table className="tnum w-full min-w-[520px] text-sm">
          <caption className="mb-2 text-left text-sm font-semibold">Staffing and supplies by night</caption>
          <thead className="text-left text-muted">
            <tr className="border-b border-line">
              <th className="py-2 font-medium">Night</th>
              <th className="py-2 text-right font-medium">Guests (range)</th>
              <th className="py-2 text-right font-medium">Volunteers</th>
              <th className="py-2 text-right font-medium">Blankets</th>
              <th className="py-2 pl-4 font-medium">Activations</th>
            </tr>
          </thead>
          <tbody>
            {nights.map((n, i) => (
              <tr key={n.day.date} className="border-b border-line/60 last:border-0">
                <td className="py-2 font-medium">{i === 0 ? "Tonight" : short(n.day.date)}</td>
                <td className="py-2 text-right">{Math.round(n.prediction.predicted)} ({Math.round(n.prediction.low)}–{Math.round(n.prediction.high)})</td>
                <td className="py-2 text-right">{n.plan.volunteers}{n.plan.extraVolunteers ? <span className="text-warm-ink"> (+{n.plan.extraVolunteers})</span> : ""}</td>
                <td className="py-2 text-right">{n.plan.blankets || <span className="text-muted">–</span>}</td>
                <td className="py-2 pl-4">{[n.plan.dayShelterExtra && "Day shelter", n.plan.warming && "Warming stations"].filter(Boolean).join(", ") || <span className="text-muted">None</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-sm text-muted">
          Volunteers = predicted guests ÷ 25, rounded up (4 on a usual night). Blankets = 1.5 × predicted guests on nights below 40°F. The same formulas fill the needs board; the multipliers are assumptions to confirm with shelter staff.
        </p>
      </div>
    </section>
  );
}

function Context() {
  const facts = [
    { n: 29509, label: "shelter nights Firehouse provided in 2025" },
    { n: 92693, label: "meals Firehouse served in 2025" },
    { n: 911, label: "people counted homeless in Jefferson, Shelby and St. Clair (2024), up from 847" },
  ];
  return (
    <section className="card rise flex flex-col p-5 sm:p-6" style={{ ["--d" as string]: "260ms" }} aria-labelledby="ctx-h">
      <h2 id="ctx-h" className="text-lg font-semibold">Why this matters in Birmingham</h2>
      <dl className="mt-4 grid gap-5">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="sr-only">{f.label}</dt>
            <dd className="display text-[46px] leading-none text-accent-ink"><CountUp value={f.n} /></dd>
            <dd className="mt-1.5 text-[15px] leading-snug text-ink/80">{f.label}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 rounded-lg bg-warm-soft p-4 text-[15px] leading-relaxed text-warm-ink">
        Birmingham has only <strong>two official warming stations</strong>, about <strong>$2,500 a night</strong> each, opened one cold snap at a time. People outside often hear last.
      </div>
    </section>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const scenario = (await searchParams).scenario === "arctic";
  const { nights, source } = await buildWeek(scenario);
  const t = nights[0];
  const q = scenario ? "?scenario=arctic" : "";

  return (
    <>
      <Nav active="/forecast" scenario={scenario} source={source} />
      <main className="mx-auto max-w-[1320px] px-4 pb-20 sm:px-8">
        <LiveHero day={t.day} q={q} scenario={scenario} />

        <div className="grid gap-6">
          <WeekStrip nights={nights} />
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <Recommendations nights={nights} />
            <Context />
          </div>
        </div>

        <footer className="mt-16 flex flex-wrap items-end justify-between gap-6">
          <p className="display text-[52px] leading-none text-accent-ink sm:text-[76px]">See it coming.</p>
          <p className="max-w-[560px] text-sm leading-relaxed text-muted">
            Weather: National Weather Service, api.weather.gov. Firehouse figures: firehouseshelter.com. Warming stations: Birmingham Watch, Jan 30 2026.
            Bed predictions are aggregate, per shelter per night, from a model trained on <strong className="text-ink">simulated</strong> history. Never about a person. <Link href={`/about${q}`} className="text-accent underline underline-offset-2">How it works</Link>
          </p>
        </footer>
      </main>
    </>
  );
}

