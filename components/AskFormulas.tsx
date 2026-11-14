import { ASK_FORMULAS as F } from "@/lib/asks";

/** The multipliers behind every ask, printed where the asks are. They are assumptions. */
export default function AskFormulas() {
  const rows = [
    ["Blankets", `predicted people × ${F.blanketsPerPerson}`, `only on nights with a low below ${F.blanketBelowF}°F`],
    ["Water bottles", `predicted people × ${F.waterPerPerson}`, "only on days with a Heat Advisory"],
    ["Volunteers", `predicted people ÷ ${F.peoplePerVolunteer}, rounded up`, "every flagged night"],
    ["Meals", `predicted people × ${F.mealsPerPerson}`, "every flagged night"],
  ];
  return (
    <section className="card rise mt-12 p-5 sm:p-6" aria-labelledby="formula-h">
      <h2 id="formula-h" className="text-lg font-semibold">How each number is made</h2>
      <p className="mt-1 max-w-[720px] text-[15px] leading-relaxed text-ink/85">
        Every ask is the shelter&rsquo;s predicted people for that night times a fixed multiplier. No AI writes or sizes an ask. A night is flagged when an activation rule fires or the forecast passes capacity.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([k, f, when]) => (
          <div key={k} className="rounded-lg bg-raised p-4">
            <dt className="font-semibold">{k}</dt>
            <dd className="tnum mt-1 text-[15px] text-accent-ink">{f}</dd>
            <dd className="mt-0.5 text-sm text-muted">{when}</dd>
            <dd className="mt-2 inline-block rounded-md bg-warm-soft px-2 py-0.5 text-sm text-warm-ink">assumption — confirm with shelter staff</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Predicted people come from a model trained on SIMULATED nightly history, so the quantities show the method, not Firehouse&rsquo;s real needs. Only Firehouse has a demand forecast; other sites get no asks until they do. Totals per shelter, never per person.
      </p>
    </section>
  );
}
