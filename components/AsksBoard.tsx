"use client";

import { useCallback, useEffect, useState } from "react";
import IsoStack, { stackUnit } from "@/components/IsoStack";
import { useVolunteerStore } from "@/components/useVolunteerStore";
import { ASK_LABEL, type Ask, type AskStatus } from "@/lib/asks";

const STATUS_TEXT: Record<AskStatus, string> = { open: "Open", pledged: "Pledged", fulfilled: "Fulfilled" };
const STATUS_CLASS: Record<AskStatus, string> = { open: "bg-raised text-ink", pledged: "bg-accent-soft text-accent-ink", fulfilled: "bg-accent text-white" };

/** The public board talks only to /api/asks: statuses in, a pledge out. No notes, no names. */
function usePublicAsks() {
  const [statuses, setStatuses] = useState<Record<string, AskStatus>>({});
  const load = useCallback(() => fetch("/api/asks", { cache: "no-store" }).then((r) => r.json()).then(setStatuses).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [load]);
  const pledge = async (id: string) => {
    const res = await fetch("/api/asks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) setStatuses(await res.json());
  };
  return { statuses, pledge };
}

type Group = { date: string; night: string; lowF: number | null; people: number; why: string; asks: Ask[] };

function Card({ ask, status, note, internal, onStatus, onNote, i }: { ask: Ask; status: AskStatus; note: string; internal: boolean; onStatus: (s: AskStatus) => void; onNote: (n: string) => void; i: number }) {
  const [changed, setChanged] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const set = (s: AskStatus) => { setChanged(true); onStatus(s); };
  const unit = stackUnit(ask.kind, ask.qty);
  const label = ask.qty === 1 ? ASK_LABEL[ask.kind].one : ASK_LABEL[ask.kind].many;
  return (
    <article className="ask-card card rise flex flex-col overflow-hidden" data-changed={changed} onAnimationEnd={(e) => { if (e.animationName === "settle") setChanged(false); }} style={{ ["--d" as string]: `${i * 70}ms` }}>
      <div className={`relative px-4 pt-3 transition-colors duration-500 ${status === "open" ? "bg-ground" : "bg-accent-soft"}`}>
        <IsoStack kind={ask.kind} qty={ask.qty} status={status} />
        <span className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-sm font-medium transition-colors duration-300 ${STATUS_CLASS[status]}`}>{STATUS_TEXT[status]}</span>
        <span className="tnum absolute right-3 bottom-2 text-xs text-muted">1 block = {unit} {unit === 1 ? ASK_LABEL[ask.kind].one : ASK_LABEL[ask.kind].many}</span>
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="flex items-baseline gap-2.5">
          <span className="display tnum text-[52px] leading-[0.9] text-accent-ink">{ask.qty.toLocaleString("en-US")}</span>
          <span className="text-lg font-semibold">{label}</span>
        </h3>
        <p className="mt-2 text-[15px] leading-snug"><strong className="font-semibold">{ask.siteName}</strong>, {ask.byWhen}.</p>
        <p className="mt-1 text-[14px] leading-snug text-muted">Why: {ask.why}. {ASK_LABEL[ask.kind].formula[0].toUpperCase()}{ASK_LABEL[ask.kind].formula.slice(1)}.</p>

        {internal && (
          <form className="mt-3" onSubmit={(e) => { e.preventDefault(); if (draft !== null) { onNote(draft); setDraft(null); } }}>
            <label htmlFor={`note-${ask.id}`} className="sr-only">Staff note for {ask.qty} {label}</label>
            <div className="flex gap-2">
              <input id={`note-${ask.id}`} value={draft ?? note} onChange={(e) => setDraft(e.target.value)} maxLength={200} placeholder="Staff note (not shown publicly)" className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-ground px-4 text-[14px] outline-none focus:border-accent" />
              {draft !== null && draft !== note && <button className="press min-h-11 shrink-0 rounded-full bg-raised px-4 text-sm font-medium hover:bg-accent-track">Save</button>}
            </div>
          </form>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          {status === "open" && <button onClick={() => set("pledged")} className="press min-h-11 rounded-full bg-accent px-6 text-[15px] font-semibold text-white hover:bg-accent-ink">Pledge</button>}
          {status === "pledged" && !internal && <p className="text-[15px] font-medium text-accent-ink">Pledged. Thank you — shelter staff will confirm the drop-off.</p>}
          {status === "pledged" && internal && <button onClick={() => set("fulfilled")} className="press min-h-11 rounded-full bg-accent px-6 text-[15px] font-semibold text-white hover:bg-accent-ink">Mark fulfilled</button>}
          {status === "fulfilled" && <p className="text-[15px] font-medium text-accent-ink">Fulfilled. Nothing more is needed here.</p>}
          {internal && status !== "open" && <button onClick={() => set("open")} className="press min-h-11 rounded-full bg-raised px-4 text-sm font-medium hover:bg-accent-track">Reopen</button>}
        </div>
      </div>
    </article>
  );
}

export default function AsksBoard({ asks, internal }: { asks: Ask[]; internal: boolean }) {
  // Staff use the shared store (status and notes). The public page never loads it.
  const staff = useVolunteerStore(internal ? 2500 : 3600000);
  const pub = usePublicAsks();
  const status = (id: string): AskStatus => (internal ? staff.store.asks?.[id]?.status : pub.statuses[id]) ?? "open";
  const note = (id: string) => (internal ? staff.store.asks?.[id]?.note ?? "" : "");
  const setStatus = (id: string, s: AskStatus) => (internal ? staff.send({ action: "askStatus", id, status: s }) : pub.pledge(id));

  const groups: Group[] = [];
  for (const a of asks) {
    let g = groups.find((x) => x.date === a.date);
    if (!g) groups.push((g = { date: a.date, night: a.night, lowF: a.lowF, people: a.people, why: a.why, asks: [] }));
    g.asks.push(a);
  }
  const count = (s: AskStatus) => asks.filter((a) => status(a.id) === s).length;
  const dateLabel = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <>
      {asks.length > 0 && (
        <div className="card rise mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 p-4 sm:px-6" style={{ ["--d" as string]: "120ms" }}>
          <dl className="flex gap-7">
            {(["open", "pledged", "fulfilled"] as const).map((s) => (
              <div key={s}>
                <dd className="display tnum text-[40px] leading-none text-accent-ink">{count(s)}</dd>
                <dt className="mt-1 text-sm text-muted">{STATUS_TEXT[s].toLowerCase()}</dt>
              </div>
            ))}
          </dl>
          <div className="flex h-3 min-w-[180px] flex-1 gap-1" role="img" aria-label={`${count("open")} open, ${count("pledged")} pledged, ${count("fulfilled")} fulfilled`}>
            {asks.map((a) => <span key={a.id} className={`flex-1 rounded-full transition-colors duration-500 ${status(a.id) === "open" ? "bg-accent-track" : status(a.id) === "pledged" ? "bg-accent/55" : "bg-accent"}`} />)}
          </div>
          {internal && <button onClick={() => staff.send({ action: "resetHub" })} className="press min-h-11 rounded-full bg-raised px-4 text-sm font-medium hover:bg-accent-track">Reset demo state</button>}
        </div>
      )}

      {groups.map((g, gi) => (
        <section key={g.date} className="mt-10" aria-labelledby={`night-${g.date}`}>
          <div className="rise flex flex-wrap items-end justify-between gap-x-6 gap-y-1" style={{ ["--d" as string]: `${160 + gi * 60}ms` }}>
            <h2 id={`night-${g.date}`} className="display text-[34px] leading-none sm:text-[40px]">{g.night === "tonight" ? "Tonight" : `${g.night} night`}</h2>
            <p className="tnum text-[15px] text-ink/85">
              {dateLabel(g.date)} · low <strong className={`font-semibold ${(g.lowF ?? 99) <= 32 ? "text-negative" : (g.lowF ?? 99) < 40 ? "text-warm-ink" : ""}`}>{g.lowF}°F</strong> · about <strong className="font-semibold">{g.people} people</strong> predicted{g.why.includes("over capacity") && <span className="text-negative">, over capacity</span>}
            </p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.asks.map((a, i) => <Card key={a.id} ask={a} i={i} internal={internal} status={status(a.id)} note={note(a.id)} onStatus={(s) => setStatus(a.id, s)} onNote={(n) => staff.send({ action: "askNote", id: a.id, note: n })} />)}
          </div>
        </section>
      ))}
    </>
  );
}
