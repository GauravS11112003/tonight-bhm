"use client";

import { useState } from "react";
import { useVolunteerStore } from "@/components/useVolunteerStore";
import { AUDIENCE_LABEL, hourLabel, type HubAlert } from "@/lib/notify/alerts";

const KIND_TEXT = { policy: "published policy", assumption: "assumption", forecast: "forecast", asks: "needs board" } as const;
const dayName = (date: string, style: "short" | "long" = "long") => new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: style, timeZone: "UTC" });
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** The week as a rail: every alert sits at the day and hour it should go out. */
function Rail({ alerts, days, lows, today, nowHour, sent }: { alerts: HubAlert[]; days: string[]; lows: (number | null)[]; today: string; nowHour: number; sent: (id: string) => boolean }) {
  const y = (hour: number) => `${8 + (Math.min(23, Math.max(6, hour)) - 6) / 17 * 84}%`; // 6 a.m. at the top, 11 p.m. at the bottom
  return (
    <div className="card rise mt-6 p-4 sm:p-6" style={{ ["--d" as string]: "120ms" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">This week&rsquo;s send times</h2>
        <p className="flex gap-4 text-sm text-muted">
          <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-warm" />Queued</span>
          <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-accent" />Sent</span>
        </p>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-2" role="img" aria-label={`${alerts.filter((a) => !sent(a.id)).length} alerts queued and ${alerts.filter((a) => sent(a.id)).length} sent across ${days.length} days`}>
        {days.map((d, di) => {
          const here = alerts.filter((a) => a.send.date === d);
          const hours = [...new Set(here.map((a) => a.send.hour))];
          return (
            <div key={d} className="min-w-0">
              <div className={`relative h-[132px] rounded-lg ${d === today ? "bg-accent-soft" : "bg-raised"}`}>
                {d === today && <span className="absolute inset-x-0 border-t border-dashed border-accent/60" style={{ top: y(nowHour) }}><span className="absolute -top-4 right-1.5 hidden text-[11px] text-accent-ink sm:block">now</span></span>}
                {hours.map((h) => {
                  const at = here.filter((a) => a.send.hour === h);
                  return (
                    <span key={h} className="absolute inset-x-0 flex -translate-y-1/2 flex-wrap justify-center gap-[3px] px-0.5" style={{ top: y(h) }}>
                      {at.map((a) => <i key={a.id} className={`rail-dot block size-2.5 rounded-full sm:size-3 ${sent(a.id) ? "is-sent bg-accent" : "bg-warm"}`} title={`${AUDIENCE_LABEL[a.audience]}, about ${a.night.toLowerCase()}`} />)}
                    </span>
                  );
                })}
              </div>
              <p className={`mt-1.5 truncate text-center text-xs sm:text-sm ${d === today ? "font-semibold text-ink" : "text-muted"}`}>{d === today ? "Today" : dayName(d, "short")}</p>
              <p className={`tnum text-center text-xs ${(lows[di] ?? 99) <= 32 ? "font-semibold text-negative" : (lows[di] ?? 99) < 40 ? "font-semibold text-warm-ink" : "text-muted"}`}>{lows[di]}°</p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-muted">Each lane runs from 6 a.m. at the top to 11 p.m. at the bottom; the figure under each day is that night's forecast low. Donors hear two days ahead at 9 a.m., volunteers the day before at noon, shelter staff and warming-station operators the evening before at 6 p.m. Lead times are assumptions.</p>
    </div>
  );
}

function Row({ a, sentAt, onSend, tonight, i }: { a: HubAlert; sentAt?: string; onSend: () => void; tonight: boolean; i: number }) {
  const [open, setOpen] = useState(false);
  const n = a.numbers;
  return (
    <li className={`notify-row card rise relative overflow-hidden ${sentAt ? "is-sent" : ""}`} style={{ ["--d" as string]: `${Math.min(i, 8) * 50}ms` }}>
      <span aria-hidden className="notify-sweep" />
      <div className="relative grid gap-x-5 gap-y-3 p-4 sm:p-5 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[17px] font-semibold">{AUDIENCE_LABEL[a.audience]}</span>
            <span className="text-[15px] text-muted">to {a.recipients.join(", ")}</span>
          </p>
          <p className="mt-1.5 text-[16px] leading-relaxed text-ink">{a.message}</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {a.triggers.map((t) => (
              <li key={t.id} className={`rounded-full px-2.5 py-1 text-sm ${t.kind === "policy" || t.kind === "assumption" ? "bg-warm-soft text-warm-ink" : t.kind === "forecast" ? "bg-negative-soft text-negative" : "bg-accent-soft text-accent-ink"}`}>
                <strong className="font-semibold">{t.label}</strong> · {KIND_TEXT[t.kind]}
              </li>
            ))}
          </ul>
          <button onClick={() => setOpen(!open)} aria-expanded={open} className="press mt-2 min-h-11 text-sm font-medium text-accent underline-offset-2 hover:underline">{open ? "Hide" : "Show"} the rule and the numbers behind this</button>
          {open && (
            <div className="rounded-lg bg-raised p-4 text-[15px]">
              <ul className="grid gap-1.5">
                {a.triggers.map((t) => <li key={t.id}><strong className="font-semibold">{t.label}:</strong> {t.reason}</li>)}
              </ul>
              <dl className="tnum mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                <div><dt className="text-sm text-muted">Forecast low</dt><dd className="font-semibold">{n.lowF}°F</dd></div>
                <div><dt className="text-sm text-muted">People predicted</dt><dd className="font-semibold">{n.people} <span className="font-normal text-muted">({n.low}–{n.high})</span></dd></div>
                <div><dt className="text-sm text-muted">Beds</dt><dd className="font-semibold">{n.capacity}</dd></div>
                <div><dt className="text-sm text-muted">Over capacity</dt><dd className={`font-semibold ${n.spill >= 1 ? "text-negative" : ""}`}>{n.spill >= 1 ? `about ${n.spill}` : "none"}</dd></div>
              </dl>
              <p className="mt-2 text-sm text-muted">Predictions come from a model trained on SIMULATED history. The message is a template filled from these numbers; no AI wrote it.</p>
            </div>
          )}
        </div>
        <div className="flex flex-col items-start gap-1.5 md:items-end md:text-right">
          <p className="tnum text-sm text-muted">About {a.night === "Tonight" ? "tonight" : `${a.night} night`}</p>
          {sentAt ? (
            <p className="notify-done flex min-h-11 items-center gap-2 rounded-full bg-accent-soft px-5 text-[15px] font-semibold text-accent-ink">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="notify-check" /></svg>
              Sent {clock(sentAt)}
            </p>
          ) : (
            <button onClick={onSend} className="press min-h-11 rounded-full bg-accent px-7 text-[15px] font-semibold text-white hover:bg-accent-ink">Send</button>
          )}
          {a.audience === "volunteers" && tonight && <p className="max-w-[220px] text-xs leading-snug text-muted">Also shows full-screen on every open volunteer phone, the same alert as the staff board.</p>}
        </div>
      </div>
    </li>
  );
}

export default function NotifyQueue({ alerts, days, lows, today, nowHour }: { alerts: HubAlert[]; days: string[]; lows: (number | null)[]; today: string; nowHour: number }) {
  const { store, send } = useVolunteerStore(2500);
  const sentAt = (id: string) => store.sent?.[id];
  const groups: { key: string; label: string; alerts: HubAlert[] }[] = [];
  for (const a of alerts) {
    const key = a.send.due ? "now" : `${a.send.date}:${a.send.hour}`;
    const label = a.send.due ? "Due now" : `${dayName(a.send.date)} ${hourLabel(a.send.hour)}`;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, label, alerts: [] }));
    g.alerts.push(a);
  }
  const left = alerts.filter((a) => !sentAt(a.id)).length;

  return (
    <>
      <Rail alerts={alerts} days={days} lows={lows} today={today} nowHour={nowHour} sent={(id) => !!sentAt(id)} />
      {store.alert && (
        <p className="mt-4 rounded-xl bg-negative-soft px-4 py-3 text-[15px] text-negative"><strong className="font-semibold">Live on volunteer phones:</strong> {store.alert.message} <button onClick={() => send({ action: "clear" })} className="press ml-1 min-h-11 font-semibold underline underline-offset-2">Stand down</button></p>
      )}
      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
        <p className="tnum text-[17px]"><strong className="font-semibold">{left}</strong> of {alerts.length} alerts still to send</p>
        <button onClick={() => send({ action: "resetHub" })} className="press min-h-11 rounded-full bg-raised px-4 text-sm font-medium hover:bg-accent-track">Reset demo state</button>
      </div>
      {groups.map((g) => (
        <section key={g.key} className="mt-6 grid gap-x-6 gap-y-3 md:grid-cols-[150px_1fr]" aria-labelledby={`send-${g.key}`}>
          <h2 id={`send-${g.key}`} className={`display text-[28px] leading-none md:pt-4 ${g.key === "now" ? "text-warm-ink" : ""}`}>{g.label}</h2>
          <ul className="grid gap-3">
            {g.alerts.map((a, i) => (
              <Row key={a.id} a={a} i={i} sentAt={sentAt(a.id)} tonight={a.date === today}
                onSend={() => send({ action: "sendAlert", id: a.id, ...(a.audience === "volunteers" && a.date === today ? { broadcast: a.message.slice(0, 200) } : {}) })} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
