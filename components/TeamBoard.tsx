"use client";

import { useState } from "react";
import { useVolunteerStore } from "@/components/useVolunteerStore";
import { REQUEST_LABEL } from "@/lib/volunteers/store";
import type { NightBrief } from "@/lib/volunteers/nights";

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

/** Staff view: forecast need vs who signed up, and the volunteers' requests. Updates every few seconds. */
export default function TeamBoard({ nights, qr, url }: { nights: NightBrief[]; qr: string; url: string }) {
  const { store, send } = useVolunteerStore(1500);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const open = store.requests.filter((r) => r.status === "open").sort((a, b) => Number(b.urgent) - Number(a.urgent));
  const done = store.requests.filter((r) => r.status === "resolved").slice(0, 5);
  const gaps = nights.map((n) => Math.max(0, n.needed - store.signups.filter((s) => s.date === n.date).length));
  const totalGap = gaps.reduce((a, b) => a + b, 0);

  const t = nights[0];
  const message = `${(t.lowF ?? 99) <= 32 ? "Freeze" : "Cold night"} tonight, ${t.lowF}°F. Firehouse needs ${gaps[0]} more volunteer${gaps[0] === 1 ? "" : "s"}.`;

  return (
    <>
    <section className={`mt-6 grid items-center gap-6 rounded-3xl p-6 text-white sm:grid-cols-[1fr_auto] ${store.alert ? "alarm" : "bg-accent-ink"}`} aria-labelledby="act-h">
      <div>
        <h2 id="act-h" className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[36px]">{store.alert ? "Alert is live on every volunteer phone" : "Tonight needs more hands"}</h2>
        <p className="tnum mt-2 text-lg text-white/85">{store.alert ? store.alert.message : `${store.signups.filter((s) => s.date === t.date).length} of ${t.needed} volunteers signed up. One tap alerts every phone with the app open.`}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {!store.alert ? (
            <button onClick={() => send({ action: "broadcast", message })} className="press min-h-14 rounded-full bg-white px-8 text-[18px] font-semibold text-negative">Activate cold-night plan</button>
          ) : (
            <button onClick={() => send({ action: "clear" })} className="press min-h-14 rounded-full bg-white/20 px-8 text-[18px] font-semibold">Stand down</button>
          )}
        </div>
      </div>
      <div className="rounded-2xl bg-white p-3 text-center text-ink">
        <div className="mx-auto size-[168px]" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="mt-1 text-sm font-semibold">Scan to volunteer</p>
        <p className="text-xs text-muted">{url}</p>
      </div>
    </section>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
      <section className="card rise p-5 sm:p-6" aria-labelledby="cov-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="cov-h" className="text-lg font-semibold">Coverage for the next 7 nights</h2>
          <p className="tnum text-[15px] text-ink/80">{totalGap === 0 ? "Every night is covered." : <><strong className="text-warm-ink">{totalGap} shift{totalGap > 1 ? "s" : ""} still open</strong> this week</>}</p>
        </div>
        <ul className="mt-4 grid gap-3">
          {nights.map((n, i) => {
            const names = store.signups.filter((s) => s.date === n.date).map((s) => s.name);
            const pct = Math.min(100, (names.length / n.needed) * 100);
            return (
              <li key={`${n.date}-${names.length}`} className="pop grid grid-cols-[150px_1fr_auto] items-center gap-x-4 gap-y-1">
                <div>
                  <p className="font-semibold">{n.label}</p>
                  <p className="tnum text-sm text-muted">{n.lowF}°F · {n.predicted} guests</p>
                </div>
                <div>
                  <div className="h-3 overflow-hidden rounded-full bg-accent-track">
                    <div className={`h-full rounded-full transition-[width] duration-700 ${gaps[i] === 0 ? "bg-positive" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">{names.length ? names.join(", ") : "No one yet"}{n.warming ? " · warming stations likely" : ""}</p>
                </div>
                <p className="tnum text-right text-[15px] font-semibold">
                  {names.length}/{n.needed}
                  {gaps[i] > 0 && <span className="block text-sm font-medium text-warm-ink">need {gaps[i]}</span>}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-sm text-muted">Need = predicted guests ÷ 25, rounded up (assumption — confirm with shelter staff). The forecast sets the need; volunteers fill it from their phones.</p>
      </section>

      <section className="card rise p-5 sm:p-6" style={{ ["--d" as string]: "100ms" }} aria-labelledby="req-h">
        <h2 id="req-h" className="text-lg font-semibold">Requests from volunteers <span className="tnum font-normal text-muted">· {open.length} open</span></h2>
        {open.length === 0 && <p className="mt-3 rounded-lg bg-raised p-4 text-[15px] text-muted">No open requests. New ones appear here within a few seconds.</p>}
        <ul className="mt-3 grid gap-3">
          {open.map((r) => (
            <li key={r.id} className={`rise rounded-lg p-4 ${r.urgent ? "bg-negative-soft" : "bg-raised"}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{REQUEST_LABEL[r.type]}{r.urgent && <span className="ml-2 text-sm text-negative">Urgent</span>}</p>
                <p className="text-sm text-muted">{r.name} · {ago(r.createdAt)}</p>
              </div>
              {r.note && <p className="mt-1 text-[15px]">{r.note}</p>}
              <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send({ action: "resolve", id: r.id, reply: replies[r.id] ?? "" }); }}>
                <label htmlFor={`reply-${r.id}`} className="sr-only">Reply to {r.name}</label>
                <input id={`reply-${r.id}`} value={replies[r.id] ?? ""} onChange={(e) => setReplies({ ...replies, [r.id]: e.target.value })} placeholder="Reply (optional)" className="min-h-10 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-[15px] outline-none focus:border-accent" />
                <button className="press min-h-10 shrink-0 rounded-full bg-accent px-4 text-[15px] font-semibold text-white hover:bg-accent-ink">Mark handled</button>
              </form>
            </li>
          ))}
        </ul>
        {done.length > 0 && (
          <>
            <h3 className="mt-5 text-sm font-semibold text-muted">Recently handled</h3>
            <ul className="mt-2 grid gap-1.5 text-[15px]">
              {done.map((r) => <li key={r.id} className="flex justify-between gap-3"><span className="truncate">{REQUEST_LABEL[r.type]}{r.reply ? `: ${r.reply}` : ""}</span><span className="shrink-0 text-muted">{r.name}</span></li>)}
            </ul>
          </>
        )}
      </section>
    </div>
    </>
  );
}
