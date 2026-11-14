"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Store } from "@/lib/volunteers/store";

export type HubData = {
  // Understand: the fastest-rising need, already suppressed on the server.
  top: { label: string; changePct: number; bars: number[] } | null;
  // Route: tonight's predicted room at the one forecast shelter.
  room: { predicted: number; capacity: number; spill: number };
  // Notify and Ask: ids only; status lives in the shared store.
  alerts: { id: string; night: string; date: string }[];
  asks: { id: string }[];
  week: { date: string; label: string }[];
};

/** Eases from the number last shown to the new one, so a live update is seen to change. */
function LiveNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { from.current = value; setShown(value); return; }
    const start = from.current, t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      const v = Math.round(start + (value - start) * (1 - Math.pow(1 - k, 3)));
      from.current = v; setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className="tnum">{shown.toLocaleString("en-US")}</span>;
}

/** Polls the aggregate intake count. Only a number crosses the wire. */
export function useRoutedToday(pollMs = 3000) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let dead = false;
    const load = () => fetch("/api/intakes", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (!dead) setN(j.routedToday ?? 0); }).catch(() => {});
    load();
    const t = setInterval(load, pollMs);
    return () => { dead = true; clearInterval(t); };
  }, [pollMs]);
  return n;
}

function Tile({ href, verb, i, figure, line, tag, children }: { href: string; verb: string; i: number; figure: React.ReactNode; line: React.ReactNode; tag?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="float-panel hub-tile rise group flex min-w-0 flex-col p-4 lg:pointer-events-auto lg:p-5" style={{ ["--d" as string]: `${420 + i * 90}ms` }}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-semibold text-ink">{verb}</span>
        <span aria-hidden className="text-accent transition-transform duration-200 group-hover:translate-x-1">→</span>
      </span>
      <span className="display mt-1.5 block text-[52px] leading-[0.95] text-accent-ink lg:text-[60px]">{figure}</span>
      <span className="mt-1.5 block text-[14px] leading-snug text-ink/85">{line}</span>
      <span className="mt-auto block pt-3">{children}</span>
      {tag && <span className="mt-2 block text-xs text-warm-ink">{tag}</span>}
    </Link>
  );
}

export default function HubTiles({ data, store, q }: { data: HubData; store: Store; q: string }) {
  const routed = useRoutedToday();
  const status = (id: string) => store.asks?.[id]?.status ?? "open";
  const open = data.asks.filter((a) => status(a.id) === "open").length;
  const pledged = data.asks.filter((a) => status(a.id) === "pledged").length;
  const fulfilled = data.asks.length - open - pledged;
  const queued = data.alerts.filter((a) => !store.sent?.[a.id]);
  const nights = [...new Set(queued.map((a) => a.date))].sort();
  const short = (date: string) => { const w = data.week.find((d) => d.date === date); return w ? w.label.slice(0, 3) : ""; };
  const span = nights.length === 0 ? "" : nights.length === 1 ? short(nights[0]) : `${short(nights[0])}–${short(nights[nights.length - 1])}`;
  const { predicted, capacity, spill } = data.room;
  const free = Math.max(0, capacity - predicted);

  return (
    <div className="order-4 mx-3 mt-3 grid grid-cols-2 gap-3 lg:order-none lg:m-0 lg:grid-cols-4">
      <Tile href={`/insights${q}`} verb="Understand" i={0}
        figure={data.top ? <>+<LiveNumber value={data.top.changePct} />%</> : "–"}
        line={data.top ? <>Top rising need this week: <strong className="font-semibold">{data.top.label.toLowerCase()}</strong>, vs last week</> : "No need is rising week over week"}
        tag="SIMULATED intake history">
        <span className="flex h-7 items-end gap-[3px]" role="img" aria-label={data.top ? `${data.top.label} intakes per day over 14 days` : undefined}>
          {(data.top?.bars ?? []).map((b, k) => (
            <span key={k} className={`grow block flex-1 rounded-[2px] ${k >= 7 ? "bg-accent" : "bg-accent-track"}`} style={{ height: `${Math.max(8, b * 100)}%`, ["--d" as string]: `${700 + k * 40}ms` }} />
          ))}
        </span>
      </Tile>

      <Tile href={`/route${q}`} verb="Route" i={1}
        figure={<LiveNumber value={routed} />}
        line={<>{routed === 1 ? "person" : "people"} routed today</>}>
        <span className="block" role="img" aria-label={`Firehouse: ${predicted} of ${capacity} beds predicted full tonight`}>
          <span className="block h-2.5 overflow-hidden rounded-full bg-accent-track"><span className={`grow-x block h-full rounded-full ${spill >= 1 ? "bg-negative" : "bg-accent"}`} style={{ width: `${Math.min(100, (predicted / capacity) * 100)}%` }} /></span>
          <span className="tnum mt-1.5 block text-xs text-muted">Firehouse tonight: {spill >= 1 ? `full, about ${spill} over` : `about ${free} beds free`}</span>
        </span>
      </Tile>

      <Tile href={`/notify${q}`} verb="Notify" i={2}
        figure={<LiveNumber value={queued.length} />}
        line={queued.length ? <>alert{queued.length === 1 ? "" : "s"} queued for {span}</> : data.alerts.length ? "Every alert has been sent" : "No rule fires this week, so nothing is queued"}>
        <span className="flex items-end justify-between gap-1" role="img" aria-label="Nights this week with alerts">
          {data.week.map((d) => {
            const all = data.alerts.filter((a) => a.date === d.date);
            const left = all.filter((a) => !store.sent?.[a.id]).length;
            return (
              <span key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <span className={`block size-2.5 rounded-full transition-colors duration-500 ${left ? "bg-warm" : all.length ? "bg-positive" : "bg-accent-track"}`} />
                <span className="text-[11px] leading-none text-muted">{d.label.slice(0, 1)}</span>
              </span>
            );
          })}
        </span>
      </Tile>

      <Tile href={`/asks${q}`} verb="Ask" i={3}
        figure={<LiveNumber value={open} />}
        line={data.asks.length ? <>open request{open === 1 ? "" : "s"} on the needs board</> : "No flagged night, so no requests"}>
        <span className="block" role="img" aria-label={`${open} open, ${pledged} pledged, ${fulfilled} fulfilled`}>
          <span className="flex h-2.5 gap-[3px]">
            {data.asks.length === 0 && <span className="block flex-1 rounded-full bg-accent-track" />}
            {data.asks.map((a) => (
              <span key={a.id} className={`block flex-1 rounded-full transition-colors duration-500 ${status(a.id) === "open" ? "bg-accent-track" : status(a.id) === "pledged" ? "bg-accent/55" : "bg-accent"}`} />
            ))}
          </span>
          <span className="tnum mt-1.5 block text-xs text-muted">{pledged} pledged · {fulfilled} fulfilled</span>
        </span>
      </Tile>
    </div>
  );
}
