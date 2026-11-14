import Link from "next/link";
import type { Night } from "@/lib/plan";
import { FORMULAS } from "@/lib/model/recommend";

const short = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
/** "Sat–Mon" style label for the nights where a test holds, or null if none do. */
function span(nights: Night[], test: (n: Night) => boolean) {
  const hits = nights.filter(test);
  if (!hits.length) return null;
  const labels = hits.map((n) => (n === nights[0] ? "Tonight" : short(n.day.date)));
  return labels.length === 1 ? labels[0] : `${labels[0]}–${labels[labels.length - 1]}`;
}

/** What staff should line up this week: four figures, each with the formula that made it. */
export default function PrepareSection({ nights, q }: { nights: Night[]; q: string }) {
  const blankets = Math.max(0, ...nights.map((n) => n.plan.blankets));
  const peakVol = Math.max(...nights.map((n) => n.plan.volunteers));
  const extra = Math.max(...nights.map((n) => n.plan.extraVolunteers));
  const warmNights = nights.filter((n) => n.plan.warming).length;
  const cost = warmNights * FORMULAS.warmingStations * FORMULAS.warmingCostPerNight;
  const spill = Math.round(nights.reduce((s, n) => s + n.prediction.spill, 0));

  const cards = [
    {
      figure: blankets ? blankets.toLocaleString("en-US") : "0",
      label: "blankets on the coldest night",
      when: span(nights, (n) => n.plan.blankets > 0),
      why: blankets ? `${FORMULAS.blanketsPerGuest} per predicted guest on nights below ${FORMULAS.blanketColdF}°F.` : `No night drops below ${FORMULAS.blanketColdF}°F this week.`,
      tone: blankets ? "accent" : "quiet",
    },
    {
      figure: extra ? `+${extra}` : `${peakVol}`,
      label: extra ? "volunteers a night above usual" : "volunteers a night covers it",
      when: span(nights, (n) => n.plan.extraVolunteers > 0),
      why: `One per ${FORMULAS.volunteersPerGuests} predicted guests, rounded up. Peak night needs ${peakVol}.`,
      tone: extra ? "accent" : "quiet",
    },
    {
      figure: `$${cost.toLocaleString("en-US")}`,
      label: warmNights ? `if both warming stations open ${warmNights} night${warmNights > 1 ? "s" : ""}` : "warming station cost expected",
      when: span(nights, (n) => n.plan.warming),
      why: `Nights × ${FORMULAS.warmingStations} stations × $2,500. Likely at 32°F or below; the city decides each time.`,
      tone: warmNights ? "warm" : "quiet",
    },
    {
      figure: `${spill}`,
      label: "person-nights with no Firehouse bed",
      when: span(nights, (n) => n.prediction.spill >= 1),
      why: spill ? "Predicted demand above 100 beds. Route overflow to an open warming station early." : "Predicted demand stays under 100 beds every night.",
      tone: spill ? "negative" : "quiet",
    },
  ] as const;
  const ink = { accent: "text-accent-ink", warm: "text-warm-ink", negative: "text-negative", quiet: "text-ink/40" };
  const dot = { accent: "bg-accent", warm: "bg-warm", negative: "bg-negative", quiet: "bg-line" };

  return (
    <section className="mt-14" aria-labelledby="prep-h">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="prep-h" className="display text-[44px] leading-none sm:text-[56px]">What to line up</h2>
          <p className="mt-3 max-w-[680px] text-[17px] leading-relaxed text-ink/85">Every figure comes from the forecast and a formula you can check by hand. The multipliers are assumptions to confirm with shelter staff.</p>
        </div>
        <Link href={`/asks${q}`} className="press rounded-full bg-accent px-6 py-3 text-[15px] font-semibold text-white hover:bg-accent-ink">Turn these into asks</Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <article key={c.label} className="card rise flex flex-col p-6" style={{ ["--d" as string]: `${i * 80}ms` }}>
            <p className="flex items-center gap-2 text-sm font-medium text-muted"><span className={`size-2 rounded-full ${dot[c.tone]}`} />{c.when ?? "Not this week"}</p>
            <p className={`display tnum mt-4 text-[64px] leading-[0.9] ${ink[c.tone]}`}>{c.figure}</p>
            <p className="mt-2 text-[15px] font-semibold leading-snug">{c.label}</p>
            <p className="mt-auto pt-4 text-sm leading-relaxed text-muted">{c.why}</p>
          </article>
        ))}
      </div>

      <div className="card rise mt-4 overflow-x-auto p-5 sm:p-6" style={{ ["--d" as string]: "320ms" }}>
        <table className="tnum w-full min-w-[560px] text-[15px]">
          <caption className="mb-3 text-left text-lg font-semibold">Night by night</caption>
          <thead className="text-left text-sm text-muted">
            <tr className="border-b border-line">
              <th className="py-2.5 font-medium">Night</th>
              <th className="py-2.5 text-right font-medium">Low</th>
              <th className="py-2.5 text-right font-medium">Guests (likely range)</th>
              <th className="py-2.5 text-right font-medium">Volunteers</th>
              <th className="py-2.5 text-right font-medium">Blankets</th>
              <th className="py-2.5 pl-6 font-medium">Activations</th>
            </tr>
          </thead>
          <tbody>
            {nights.map((n, i) => (
              <tr key={n.day.date} className={`border-b border-line/60 last:border-0 ${i === 0 ? "bg-accent-soft/60" : ""}`}>
                <td className="py-2.5 pl-2 font-semibold">{i === 0 ? "Tonight" : short(n.day.date)}</td>
                <td className="py-2.5 text-right">{n.day.lowF}°F</td>
                <td className="py-2.5 text-right">
                  <span className={n.prediction.spill >= 1 ? "font-semibold text-negative" : ""}>{Math.round(n.prediction.raw)}</span>
                  <span className="text-muted"> ({Math.round(n.prediction.low)}–{Math.round(n.prediction.high)})</span>
                </td>
                <td className="py-2.5 text-right">{n.plan.volunteers}{n.plan.extraVolunteers ? <span className="text-warm-ink"> +{n.plan.extraVolunteers}</span> : ""}</td>
                <td className="py-2.5 text-right">{n.plan.blankets || <span className="text-muted">–</span>}</td>
                <td className="py-2.5 pl-6">{[n.plan.dayShelterExtra && "Day shelter", n.plan.warming && "Warming stations"].filter(Boolean).join(", ") || <span className="text-muted">None</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
