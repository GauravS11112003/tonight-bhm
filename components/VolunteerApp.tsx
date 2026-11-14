"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import sitesJson from "@/data/sites.json";
import ClientCanvas from "@/components/ClientCanvas";
import { Mark } from "@/components/Nav";
import { useDevice, useVolunteerStore } from "@/components/useVolunteerStore";
import { REQUEST_LABEL, REQUEST_TYPES, type HelpRequest } from "@/lib/volunteers/store";
import type { NightBrief } from "@/lib/volunteers/nights";
import type { Site } from "@/lib/types";

const SITES = sitesJson as Site[];
type Tab = "tonight" | "shifts" | "requests" | "resources";

const ICONS: Record<Tab, string> = {
  tonight: "M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z",
  shifts: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  requests: "M4 5h16v11H9l-5 4V5Z",
  resources: "M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.800-7 11-7 11Zm0-8.500a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5Z",
};
const TAB_LABEL: Record<Tab, string> = { tonight: "Tonight", shifts: "Shifts", requests: "Requests", resources: "Resources" };

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};
const shortDate = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function Coverage({ have, need }: { have: number; need: number }) {
  return (
    <div className="flex gap-1" role="img" aria-label={`${have} of ${need} volunteers signed up`}>
      {Array.from({ length: Math.max(need, have) }, (_, i) => (
        <span key={i} className={`h-2 flex-1 rounded-full transition-colors duration-500 ${i < have ? (i < need ? "bg-accent" : "bg-positive") : "bg-accent-track"}`} />
      ))}
    </div>
  );
}

export default function VolunteerApp({ nights, scenario }: { nights: NightBrief[]; scenario: boolean }) {
  const [tab, setTab] = useState<Tab>("tonight");
  const { store, send } = useVolunteerStore();
  const { deviceId, name, setName } = useDevice();
  const [draftName, setDraftName] = useState("");
  const [type, setType] = useState<HelpRequest["type"]>("supplies");
  const [note, setNote] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [sent, setSent] = useState(false);

  const q = scenario ? "?scenario=arctic" : "";
  const t = nights[0];
  const [dismissed, setDismissed] = useState("");
  const alert = store.alert && store.alert.at !== dismissed ? store.alert : null;
  useEffect(() => { if (alert) navigator.vibrate?.([300, 120, 300, 120, 600]); }, [alert?.at]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = (date: string) => store.signups.some((s) => s.date === date && s.deviceId === deviceId);
  const count = (date: string) => store.signups.filter((s) => s.date === date).length;
  const myRequests = store.requests.filter((r) => r.deviceId === deviceId);
  const openMine = myRequests.filter((r) => r.status === "open").length;

  const toggleShift = (date: string) =>
    mine(date) ? send({ action: "cancel", date, deviceId }) : send({ action: "signup", date, name, deviceId });

  // First visit: one field, no account. A first name is all staff need to say hello.
  if (deviceId && !name) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center bg-accent-ink px-6 text-white">
        <Mark size={44} />
        <h1 className="rise mt-6 text-[40px] leading-[1.02] font-semibold tracking-[-0.03em]">Thanks for showing up.</h1>
        <p className="rise mt-3 text-lg text-white/80" style={{ ["--d" as string]: "80ms" }}>What should staff call you? A first name or initials is enough.</p>
        <form className="rise mt-6 flex gap-2" style={{ ["--d" as string]: "160ms" }} onSubmit={(e) => { e.preventDefault(); if (draftName.trim()) setName(draftName.trim().slice(0, 24)); }}>
          <label htmlFor="vname" className="sr-only">First name or initials</label>
          <input id="vname" value={draftName} onChange={(e) => setDraftName(e.target.value)} autoComplete="given-name" placeholder="First name" className="min-h-12 flex-1 rounded-full bg-white px-5 text-[17px] text-ink outline-none" />
          <button className="press min-h-12 rounded-full bg-white px-6 text-[16px] font-semibold text-accent-ink">Start</button>
        </form>
      </div>
    );
  }

  if (alert && name) {
    return (
      <div role="alertdialog" aria-labelledby="al-h" className="alarm mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-6 text-white">
        <p className="breathe text-[17px] font-semibold">Alert from Firehouse staff</p>
        <h1 id="al-h" className="rise mt-3 text-[44px] leading-[1.02] font-semibold tracking-[-0.03em]">{alert.message}</h1>
        <p className="tnum mt-4 text-xl text-white/85">{count(t.date)} of {t.needed} volunteers signed up for tonight.</p>
        <button onClick={() => { if (!mine(t.date)) send({ action: "signup", date: t.date, name, deviceId }); setDismissed(alert.at); }} className="press mt-8 min-h-16 rounded-full bg-white text-[20px] font-semibold text-negative">
          {mine(t.date) ? "I'm already in" : "I can help tonight"}
        </button>
        <button onClick={() => setDismissed(alert.at)} className="press mt-3 min-h-12 rounded-full bg-white/15 text-[16px] font-medium">Not tonight</button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-[480px] bg-ground pb-28">
      {scenario && <p className="bg-warm px-5 py-2 text-sm font-medium text-white">SCENARIO — not the live forecast.</p>}
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <Mark />
          <span className="text-[17px] font-semibold">Tonight BHM</span>
        </div>
        <span className="rounded-full bg-raised px-3 py-1.5 text-sm font-medium">Hi, {name || "…"}</span>
      </header>

      {tab === "tonight" && (
        <main className="px-5">
          <section className="rise relative overflow-hidden rounded-3xl bg-accent-ink p-6 text-white" aria-labelledby="vt-h">
            <ClientCanvas kind="particles" lowF={t.lowF} />
            <div className="relative">
              <h1 id="vt-h" className="text-[17px] font-medium text-white/80">Tonight at Firehouse</h1>
              <p className="display tnum mt-2 text-[96px] leading-[0.85]">{t.lowF}°F</p>
              <p className="tnum mt-3 text-xl leading-snug">Expect <strong className="font-semibold">{t.low}–{t.high} of 100 beds</strong> filled.{t.spill > 0 ? ` About ${t.spill} more people than beds.` : ""}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm font-medium">
                {t.alerts.map((a) => <span key={a} className="rounded-full bg-white/15 px-3 py-1">{a}</span>)}
                {t.dayExtra && <span className="rounded-full bg-white px-3 py-1 text-warm-ink">Day shelter extra day</span>}
                {t.warming && <span className="rounded-full bg-warm px-3 py-1">Warming stations likely</span>}
              </div>
            </div>
          </section>

          <section className="rise mt-4 rounded-3xl bg-surface p-5" style={{ ["--d" as string]: "80ms" }} aria-labelledby="cov-h">
            <div className="flex items-baseline justify-between">
              <h2 id="cov-h" className="text-[17px] font-semibold">Volunteers tonight</h2>
              <p className="tnum text-sm text-muted">{count(t.date)} of {t.needed} signed up</p>
            </div>
            <div className="mt-3"><Coverage have={count(t.date)} need={t.needed} /></div>
            <button onClick={() => toggleShift(t.date)} className={`press mt-4 min-h-12 w-full rounded-full text-[16px] font-semibold ${mine(t.date) ? "bg-positive-soft text-positive" : "bg-accent text-white"}`}>
              {mine(t.date) ? "You're on tonight · tap to cancel" : "I can help tonight"}
            </button>
          </section>

          <section className="rise mt-4 rounded-3xl bg-surface p-5" style={{ ["--d" as string]: "140ms" }} aria-labelledby="brief-h">
            <h2 id="brief-h" className="text-[17px] font-semibold">Your briefing</h2>
            <ul className="mt-3 grid gap-3 text-[16px] leading-snug">
              {t.reasons.map((r) => <li key={r} className="flex gap-3"><span className="mt-2 size-2 shrink-0 rounded-full bg-warm" />{r}</li>)}
              {t.blankets > 0 && <li className="flex gap-3"><span className="mt-2 size-2 shrink-0 rounded-full bg-accent" />Stage about {t.blankets} blankets near the door.</li>}
              {t.warming && <li className="flex gap-3"><span className="mt-2 size-2 shrink-0 rounded-full bg-accent" />If Firehouse fills, Jimmie Hale Mission usually opens 6 p.m.–7 a.m. Confirm with staff first.</li>}
              <li className="flex gap-3"><span className="mt-2 size-2 shrink-0 rounded-full bg-accent" />Never ask a guest for a name, date of birth or ID.</li>
            </ul>
            <Link href={`/route${q}`} className="press mt-5 flex min-h-12 items-center justify-center rounded-full bg-ink text-[16px] font-semibold text-white">Route a person at the door</Link>
          </section>
        </main>
      )}

      {tab === "shifts" && (
        <main className="px-5">
          <h1 className="rise text-[32px] leading-tight font-semibold tracking-[-0.03em]">This week&apos;s shifts</h1>
          <p className="rise mt-1 text-[15px] text-muted" style={{ ["--d" as string]: "60ms" }}>Need is one volunteer per 25 expected guests (assumption). Staff set the exact hours.</p>
          <ul className="mt-4 grid gap-3">
            {nights.map((n, i) => (
              <li key={n.date} className="rise rounded-3xl bg-surface p-5" style={{ ["--d" as string]: `${80 + i * 60}ms` }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[17px] font-semibold">{n.label} <span className="font-normal text-muted">· {shortDate(n.date)}</span></p>
                    <p className="tnum mt-0.5 text-[15px] text-ink/80">Low {n.lowF}°F · about {n.predicted} guests</p>
                  </div>
                  {n.extra > 0 && <span className="shrink-0 rounded-full bg-warm-soft px-2.5 py-1 text-sm font-medium text-warm-ink">+{n.extra} needed</span>}
                </div>
                <div className="mt-3"><Coverage have={count(n.date)} need={n.needed} /></div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="tnum text-sm text-muted">
                    {count(n.date)} of {n.needed}
                    {count(n.date) > 0 && ` · ${store.signups.filter((s) => s.date === n.date).map((s) => s.name).join(", ")}`}
                  </p>
                  <button onClick={() => toggleShift(n.date)} aria-pressed={mine(n.date)} className={`press min-h-11 shrink-0 rounded-full px-5 text-[15px] font-semibold ${mine(n.date) ? "bg-positive-soft text-positive" : "bg-accent text-white"}`}>
                    {mine(n.date) ? "Signed up ✓" : "Sign up"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </main>
      )}

      {tab === "requests" && (
        <main className="px-5">
          <h1 className="rise text-[32px] leading-tight font-semibold tracking-[-0.03em]">Ask staff for something</h1>
          <form
            className="rise mt-4 rounded-3xl bg-surface p-5" style={{ ["--d" as string]: "60ms" }}
            onSubmit={async (e) => {
              e.preventDefault();
              if (await send({ action: "request", type, note, urgent, name, deviceId })) { setNote(""); setUrgent(false); setSent(true); setTimeout(() => setSent(false), 2500); }
            }}
          >
            <fieldset>
              <legend className="text-[15px] font-semibold">What do you need?</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {REQUEST_TYPES.map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={type === k} onClick={() => setType(k)} className={`press min-h-11 rounded-full px-4 text-[15px] font-medium ${type === k ? "bg-accent text-white" : "bg-raised"}`}>
                    {REQUEST_LABEL[k]}
                  </button>
                ))}
              </div>
            </fieldset>
            <label htmlFor="rnote" className="mt-4 block text-[15px] font-semibold">Details</label>
            <textarea id="rnote" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={400} placeholder="We're down to one box of blankets at the front desk." className="mt-2 w-full rounded-2xl border border-line bg-ground p-3 text-[16px] outline-none focus:border-accent" />
            <label className={`press mt-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-full px-4 text-[15px] ${urgent ? "bg-negative-soft text-negative" : "bg-raised"}`}>
              <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="size-4 accent-[var(--negative)]" />
              Urgent: staff should see this now
            </label>
            <button className="press mt-4 min-h-12 w-full rounded-full bg-accent text-[16px] font-semibold text-white">{sent ? "Sent to staff ✓" : "Send to staff"}</button>
            <p className="mt-3 text-sm text-muted">For a medical emergency call 911 first. Don&apos;t put guests&apos; names in requests.</p>
          </form>

          <h2 className="mt-6 text-[17px] font-semibold">Your requests</h2>
          {myRequests.length === 0 && <p className="mt-2 rounded-3xl bg-surface p-5 text-[15px] text-muted">Nothing sent yet. Replies from staff show up here.</p>}
          <ul className="mt-2 grid gap-3">
            {myRequests.map((r) => (
              <li key={r.id} className="rounded-3xl bg-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{REQUEST_LABEL[r.type]}</p>
                  <span className={`rounded-full px-2.5 py-1 text-sm font-medium ${r.status === "open" ? "bg-warm-soft text-warm-ink" : "bg-positive-soft text-positive"}`}>{r.status === "open" ? "Waiting on staff" : "Handled"}</span>
                </div>
                {r.note && <p className="mt-1 text-[15px] text-ink/80">{r.note}</p>}
                {r.reply && <p className="mt-3 rounded-2xl bg-accent-soft p-3 text-[15px] text-accent-ink"><strong className="font-semibold">Staff:</strong> {r.reply}</p>}
                <p className="mt-2 text-xs text-muted">{ago(r.createdAt)}</p>
              </li>
            ))}
          </ul>
        </main>
      )}

      {tab === "resources" && (
        <main className="px-5">
          <h1 className="rise text-[32px] leading-tight font-semibold tracking-[-0.03em]">Who to call</h1>
          <a href="tel:911" className="rise press mt-4 flex min-h-14 items-center justify-between rounded-3xl bg-negative px-5 text-white" style={{ ["--d" as string]: "60ms" }}>
            <span className="text-[17px] font-semibold">Emergency</span><span className="tnum text-[17px] font-semibold">Call 911</span>
          </a>
          <ul className="mt-3 grid gap-3">
            {[...SITES.map((s) => ({ name: s.name, phone: s.phone, line: s.hours ?? s.notes, address: s.address })), { name: "2-1-1", phone: "211", line: "United Way 24-hour line for shelter, food and crisis help.", address: null }].map((s, i) => (
              <li key={s.name} className="rise rounded-3xl bg-surface p-5" style={{ ["--d" as string]: `${100 + i * 50}ms` }}>
                <p className="text-[17px] font-semibold leading-snug">{s.name}</p>
                <p className="mt-1 text-[15px] leading-snug text-ink/80">{s.line}</p>
                <p className="mt-1 text-sm text-muted">{s.address ?? "Address unverified — call"}</p>
                {s.phone ? (
                  <a href={`tel:${s.phone.replace(/\D/g, "")}`} className="press tnum mt-3 inline-flex min-h-11 items-center rounded-full bg-accent-soft px-5 text-[15px] font-semibold text-accent-ink">Call {s.phone}</a>
                ) : (
                  <span className="mt-3 inline-flex min-h-11 items-center rounded-full bg-raised px-5 text-[15px] text-muted">Phone unverified</span>
                )}
              </li>
            ))}
          </ul>
        </main>
      )}

      <nav aria-label="Volunteer app" className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] border-t border-line bg-surface px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <ul className="grid grid-cols-4">
          {(Object.keys(TAB_LABEL) as Tab[]).map((k) => (
            <li key={k}>
              <button onClick={() => { setTab(k); window.scrollTo({ top: 0 }); }} aria-current={tab === k ? "page" : undefined} className={`press relative flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-medium ${tab === k ? "bg-accent-soft text-accent" : "text-muted"}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICONS[k]} /></svg>
                {TAB_LABEL[k]}
                {k === "requests" && openMine > 0 && <span className="tnum absolute top-1 right-[26%] flex size-4 items-center justify-center rounded-full bg-warm text-[10px] text-white">{openMine}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
