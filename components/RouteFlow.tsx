"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import sitesJson from "@/data/sites.json";
import { FALLBACKS, needWord, route, type AgeBand, type Gender, type Intake, type RankedSite, type Tonight } from "@/lib/routing/route";
import { NEEDS } from "@/lib/intake/schema";
import type { Need, Site } from "@/lib/types";

const SITES = sitesJson as Site[];
const AGES: { v: AgeBand; label: string }[] = [
  { v: "under-18", label: "Under 18" },
  { v: "18-24", label: "18–24" },
  { v: "25-54", label: "25–54" },
  { v: "55+", label: "55+" },
];
const GENDERS: { v: Gender; label: string }[] = [
  { v: "man", label: "Man" },
  { v: "woman", label: "Woman" },
  { v: "nonbinary", label: "Nonbinary" },
  { v: "prefer-not", label: "Prefer not to say" },
];
const STEPS = ["Intake", "Confirm needs", "Where to go"];

function Choice<T extends string>({ name, options, value, onChange }: { name: string; options: { v: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`press min-h-11 rounded-full px-4 text-[15px] font-medium ${value === o.v ? "bg-accent text-white" : "bg-raised text-ink hover:bg-accent-track"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SiteCard({ r, rank }: { r: RankedSite; rank?: number }) {
  const s = r.site;
  return (
    <article className={`rise rounded-xl p-5 ${rank === 0 ? "bg-surface ring-2 ring-accent" : "card"}`} style={{ ["--d" as string]: `${(rank ?? 0) * 90}ms` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {rank === 0 && <p className="mb-1 text-sm font-semibold text-accent">Best fit tonight</p>}
          <h3 className="text-lg font-semibold leading-snug">{s.name}</h3>
          <p className="mt-0.5 text-sm text-muted">{s.address ?? "Address unverified — call"}{s.hours ? ` · ${s.hours}` : ""}</p>
        </div>
        {s.phone ? (
          <a href={`tel:${s.phone.replace(/\D/g, "")}`} className="press tnum rounded-full bg-accent-soft px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-track">
            Call {s.phone}
          </a>
        ) : (
          <span className="rounded-full bg-raised px-3 py-1.5 text-sm text-muted">Phone unverified</span>
        )}
      </div>
      <p className="mt-3 text-[15px] font-medium">{r.summary.replace(/\.$/, "")}.</p>
      {r.spare !== null && (
        <div className="mt-3">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-accent-track" aria-hidden>
            <div className="grow-x h-full rounded-full bg-accent" style={{ width: `${100 - (r.spare / (s.capacity ?? 100)) * 100}%` }} />
          </div>
          <p className="tnum mt-1.5 text-sm text-muted">About {r.spare} spare bed{r.spare === 1 ? "" : "s"} predicted (capacity {s.capacity} − predicted demand).</p>
        </div>
      )}
      <ul className="mt-3 grid gap-1 text-[15px]">
        {r.passed.map((p) => <li key={p} className="flex gap-2"><span className="text-positive">✓</span>{p.replace(/ ✓$/, "")}</li>)}
        {r.failed.map((f) => <li key={f} className="flex gap-2 text-negative"><span>✕</span>{f}</li>)}
        {r.needsMet.length > 0 && <li className="flex gap-2"><span className="text-positive">✓</span>Meets: {r.needsMet.map(needWord).join(", ")}</li>}
        {r.caveats.map((c) => <li key={c} className="flex gap-2 text-warm-ink"><span>!</span>{c}</li>)}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Verified {s.verifiedAt}. {s.sourceUrl ? <a className="underline underline-offset-2" href={s.sourceUrl} target="_blank" rel="noreferrer">Source</a> : "No public source yet."}
      </p>
    </article>
  );
}

export default function RouteFlow({ tonight }: { tonight: Tonight }) {
  const [step, setStep] = useState(0);
  const [note, setNote] = useState("");
  const [ageBand, setAge] = useState<AgeBand | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [placeTonight, setPlace] = useState<boolean | null>(null);
  const [flags, setFlags] = useState({ mobility: false, medication: false, sickNow: false });
  const [needs, setNeeds] = useState<Need[]>([]);
  const [suggested, setSuggested] = useState<Need[]>([]);
  const [source, setSource] = useState<"claude" | "keywords" | "manual" | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);

  const ready = ageBand && gender && placeTonight !== null;

  async function suggest() {
    setLoading(true);
    let got: Need[] = [];
    try {
      if (note.trim()) {
        const res = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
        const j = await res.json();
        got = j.needs ?? [];
        setSource(j.source);
      } else setSource("manual");
    } catch {
      setSource("manual");
    }
    if (placeTonight && !got.includes("shelter_tonight")) got = ["shelter_tonight", ...got];
    setSuggested(got);
    setNeeds(got);
    setLoading(false);
    setStep(1);
  }

  const intake: Intake | null = ready ? { ageBand: ageBand!, gender: gender!, needsPlaceTonight: placeTonight!, needs, flags } : null;
  const result = useMemo(() => (intake && step === 2 ? route(intake, SITES, tonight) : null), [intake, step, tonight]);

  // The hub's insights count needs, not people. When the results appear, record one
  // aggregate line: the confirmed need tags and the top site id. The server adds the date.
  // The note, age, gender and health flags never leave this screen.
  const recorded = useRef(false);
  useEffect(() => {
    if (!result || recorded.current) return;
    recorded.current = true;
    fetch("/api/intakes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ needs, topSite: result.ranked[0]?.site.id ?? null }) }).catch(() => {});
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  // A volunteer may text the person their own recommendation, once. The link opens the
  // volunteer's own messaging app; the number is typed there and never touches this app.
  const top = result?.ranked[0]?.site;
  const sms = top
    ? `sms:?&body=${encodeURIComponent(`Tonight: ${top.name}${top.address ? `, ${top.address}` : ""}${top.phone ? `. Call ${top.phone}` : ". Call 2-1-1 for the address"}. For housing: One Roof Coordinated Entry (205) 254-8833. Any time: call 2-1-1.`)}`
    : null;

  function reset() {
    recorded.current = false;
    setStep(0); setNote(""); setAge(null); setGender(null); setPlace(null);
    setFlags({ mobility: false, medication: false, sickNow: false }); setNeeds([]); setSuggested([]); setShowExcluded(false);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[44px]">Route a person tonight</h1>
          <p className="mt-2 max-w-[620px] text-[17px] text-ink/80">
            Three short steps wherever you meet them. We never ask for a name, date of birth or ID. Tonight&apos;s low is <span className="tnum font-semibold">{tonight.lowF}°F</span>.
          </p>
        </div>
        <ol className="flex gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined} className={`rounded-full px-3 py-1.5 text-sm font-medium ${i === step ? "bg-accent text-white" : i < step ? "bg-accent-soft text-accent-ink" : "bg-raised text-muted"}`}>
              {s}
            </li>
          ))}
        </ol>
      </div>

      {step === 0 && (
        <form className="card rise mt-6 grid gap-6 p-5 sm:p-7" onSubmit={(e) => { e.preventDefault(); if (ready) suggest(); }}>
          <div>
            <label htmlFor="note" className="text-[15px] font-semibold">What did they tell you?</label>
            <p id="note-help" className="mt-0.5 text-sm text-muted">Their words, in a sentence or two. Leave out names. Only this note is sent to AI, to suggest needs.</p>
            <textarea
              id="note" aria-describedby="note-help" value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              placeholder="Slept by the bus station last night, soaked from the rain, hasn't eaten today. Wants to get an apartment eventually."
              className="mt-2 w-full rounded-lg border border-line bg-ground p-3 text-[16px] leading-relaxed outline-none focus:border-accent"
            />
          </div>
          <fieldset><legend className="mb-2 text-[15px] font-semibold">Age</legend><Choice name="Age" options={AGES} value={ageBand} onChange={setAge} /></fieldset>
          <fieldset><legend className="mb-2 text-[15px] font-semibold">How do they describe themselves?</legend><Choice name="Gender" options={GENDERS} value={gender} onChange={setGender} /></fieldset>
          <fieldset>
            <legend className="mb-2 text-[15px] font-semibold">Do they need a place to sleep tonight?</legend>
            <Choice name="Needs a place tonight" options={[{ v: "yes", label: "Yes" }, { v: "no", label: "No" }]} value={placeTonight === null ? null : placeTonight ? "yes" : "no"} onChange={(v) => setPlace(v === "yes")} />
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-[15px] font-semibold">Anything about mobility or health?</legend>
            <div className="flex flex-wrap gap-2">
              {([["mobility", "Uses a wheelchair, walker or cane"], ["medication", "Needs medication tonight"], ["sickNow", "Sick or injured right now"]] as const).map(([k, label]) => (
                <label key={k} className={`press flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-[15px] ${flags[k] ? "bg-warm-soft text-warm-ink" : "bg-raised"}`}>
                  <input type="checkbox" className="size-4 accent-[var(--warm)]" checked={flags[k]} onChange={(e) => setFlags({ ...flags, [k]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          {flags.sickNow && <p role="alert" className="rounded-lg bg-negative-soft p-3 text-[15px] font-medium text-negative">If this is an emergency, call 911 now. Routing can wait.</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={!ready || loading} className="press min-h-11 rounded-full bg-accent px-6 text-[15px] font-semibold text-white hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40">
              {loading ? "Reading the note…" : "Suggest needs"}
            </button>
            {!ready && <span className="text-sm text-muted">Choose age, how they describe themselves, and tonight.</span>}
          </div>
        </form>
      )}

      {step === 1 && (
        <section className="card rise mt-6 p-5 sm:p-7" aria-labelledby="confirm-h">
          <h2 id="confirm-h" className="text-xl font-semibold">Confirm what they need</h2>
          <p className="mt-1 text-[15px] text-ink/80">
            {source === "claude" ? "Claude suggested the highlighted needs from the note." : source === "keywords" ? "Suggested from keywords in the note (AI not configured)." : "No note, so nothing was suggested."} Tap to add or remove. You decide; the suggestion does not.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {NEEDS.map((n) => {
              const on = needs.includes(n);
              return (
                <button
                  key={n} type="button" aria-pressed={on}
                  onClick={() => setNeeds(on ? needs.filter((x) => x !== n) : [...needs, n])}
                  className={`press min-h-11 rounded-full px-4 text-[15px] font-medium ${on ? "bg-accent text-white" : "bg-raised text-ink hover:bg-accent-track"}`}
                >
                  {on ? "✓ " : "+ "}{needWord(n)}
                  {suggested.includes(n) && <span className={`ml-2 text-xs ${on ? "text-white/80" : "text-muted"}`}>suggested</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-7 flex gap-3">
            <button onClick={() => setStep(0)} className="press min-h-11 rounded-full bg-raised px-5 text-[15px] font-medium">Back</button>
            <button onClick={() => setStep(2)} className="press min-h-11 rounded-full bg-accent px-6 text-[15px] font-semibold text-white hover:bg-accent-ink">
              Find where to go
            </button>
          </div>
        </section>
      )}

      {step === 2 && result && (
        <section className="mt-6" aria-labelledby="results-h">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="results-h" className="text-xl font-semibold">
              {result.ranked.length ? `${result.ranked.length} place${result.ranked.length > 1 ? "s" : ""} fit tonight` : "No listed place fits tonight"}
            </h2>
            <p className="text-sm text-muted">Ranked by predicted spare beds, then an open warming station on a cold night, then needs met.</p>
          </div>
          {needs.includes("medical") && (
            <p className="mt-3 rounded-lg bg-warm-soft p-3 text-[15px] text-warm-ink">No listed site offers medical care. For urgent care call 911; otherwise ask 2-1-1 for a clinic.</p>
          )}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {result.ranked.map((r, i) => <SiteCard key={r.site.id} r={r} rank={i} />)}
          </div>

          {sms && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <a href={sms} className="press flex min-h-11 items-center rounded-full bg-raised px-5 text-[15px] font-medium hover:bg-accent-track">Text them this recommendation</a>
              <p className="max-w-[520px] text-sm text-muted">Opens your own messaging app with the top place filled in. You type their number there, once; this app never sees or stores it.</p>
            </div>
          )}

          <div className="mt-6 rounded-xl bg-accent-soft p-5">
            <h3 className="font-semibold text-accent-ink">Always offer</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {FALLBACKS.map((f) => (
                <li key={f.name} className="text-[15px]">
                  <a href={`tel:${f.phone.replace(/\D/g, "")}`} className="font-semibold text-accent-ink underline underline-offset-2">{f.name} · {f.phone}</a>
                  <p className="text-ink/80">{f.what}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6">
            <button onClick={() => setShowExcluded(!showExcluded)} aria-expanded={showExcluded} className="press rounded-full bg-raised px-4 py-2 text-[15px] font-medium hover:bg-accent-track">
              {showExcluded ? "Hide" : "Show"} {result.excluded.length} excluded place{result.excluded.length === 1 ? "" : "s"} and why
            </button>
            {showExcluded && <div className="mt-4 grid gap-4 md:grid-cols-2">{result.excluded.map((r) => <SiteCard key={r.site.id} r={r} />)}</div>}
          </div>

          <div className="mt-8 flex gap-3">
            <button onClick={() => setStep(1)} className="press min-h-11 rounded-full bg-raised px-5 text-[15px] font-medium">Edit needs</button>
            <button onClick={reset} className="press min-h-11 rounded-full bg-accent px-6 text-[15px] font-semibold text-white hover:bg-accent-ink">Next person</button>
          </div>
        </section>
      )}
    </div>
  );
}
