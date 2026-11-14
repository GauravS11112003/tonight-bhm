"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import sitesJson from "@/data/sites.json";
import ClientCanvas from "@/components/ClientCanvas";
import { predictNight } from "@/lib/model/forecast";
import { evaluateAll } from "@/lib/rules/engine";
import { route, type Intake } from "@/lib/routing/route";
import type { ForecastDay, Site } from "@/lib/types";

// DEMO BUILD. A "what if" slider over tonight's real forecast. Everything on screen is
// recomputed by the same model, rules and routing as the real app; nothing is scripted.
const SITES = sitesJson as Site[];
const person = (gender: "man" | "woman"): Intake => ({
  ageBand: "25-54", gender, needsPlaceTonight: true, needs: ["shelter_tonight", "warmth"],
  flags: { mobility: false, medication: false, sickNow: false },
});

const mix = (a: number[], b: number[], k: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`;

/** Wind made from filtered noise; louder and higher as it gets colder. */
function useWind(on: boolean, k: number) {
  const nodes = useRef<{ ctx: AudioContext; gain: GainNode; filter: BiquadFilterNode } | null>(null);
  useEffect(() => {
    if (!on) { nodes.current?.ctx.close(); nodes.current = null; return; }
    const ctx = new AudioContext();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = "bandpass"; filter.Q.value = 0.8;
    const gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(ctx.destination); src.start();
    nodes.current = { ctx, gain, filter };
    return () => { ctx.close(); nodes.current = null; };
  }, [on]);
  useEffect(() => {
    const n = nodes.current; if (!n) return;
    n.gain.gain.linearRampToValueAtTime(0.02 + k * 0.3, n.ctx.currentTime + 0.3);
    n.filter.frequency.linearRampToValueAtTime(300 + k * 900, n.ctx.currentTime + 0.3);
  }, [k, on]);
}

export default function LiveHero({ day, q, scenario }: { day: ForecastDay; q: string; scenario: boolean }) {
  const real = day.lowF ?? 50;
  const [temp, setTemp] = useState(real);
  const [rain, setRain] = useState(Math.round(day.precipProb * 100));
  const [sound, setSound] = useState(false);
  const [slow, setSlow] = useState({ temp: real, rain: Math.round(day.precipProb * 100) }); // debounced, for the 3D canvases
  useEffect(() => { const t = setTimeout(() => setSlow({ temp, rain }), 160); return () => clearTimeout(t); }, [temp, rain]);

  const whatIf = temp !== real || rain !== Math.round(day.precipProb * 100);
  const d: ForecastDay = { ...day, lowF: temp, precipProb: rain / 100, alerts: whatIf ? [] : day.alerts };
  const p = predictNight(d);
  const results = evaluateAll(d);
  const ps = predictNight({ ...day, lowF: slow.temp, precipProb: slow.rain / 100 });

  const routes = useMemo(() => {
    const tonight = { date: d.date, weekday: new Date(d.date + "T12:00:00Z").getUTCDay(), lowF: temp, results, predictions: { "firehouse-shelter": p } };
    return (["man", "woman"] as const).map((g) => {
      const r = route(person(g), SITES, tonight).ranked[0];
      return { g, name: r?.site.name ?? "No listed place: call 2-1-1", why: r ? (r.warmingActive ? "warming station open" : r.spare !== null ? `${r.spare} spare beds predicted` : "open nightly") : "" };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temp, rain]);

  const k = Math.min(1, Math.max(0, (52 - temp) / 40)); // 0 mild → 1 brutal
  useWind(sound, k);
  const dark = k > 0.4;
  const bg = mix([245, 248, 251], [6, 18, 38], k);
  const ink = dark ? "#ffffff" : "var(--text)";
  const over = p.spill >= 1;

  return (
    <section
      className="relative -mx-4 overflow-hidden rounded-b-[36px] px-4 pt-6 pb-8 transition-colors duration-300 sm:-mx-8 sm:px-8"
      style={{ background: bg, color: ink }}
      aria-labelledby="tonight-h"
    >
      <ClientCanvas kind="particles" lowF={slow.temp} />
      <div className="relative grid items-center gap-6 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 id="tonight-h" className="text-[44px] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-[60px]">Tonight in Birmingham</h1>
            {whatIf && (
              <button onClick={() => { setTemp(real); setRain(Math.round(day.precipProb * 100)); }} className="press rounded-full bg-warm px-3 py-1.5 text-sm font-semibold text-white">
                WHAT IF — not the forecast · reset
              </button>
            )}
          </div>

          <div className="mt-4 flex items-end gap-5">
            <p className="tnum text-[120px] leading-[0.85] font-semibold tracking-[-0.05em] sm:text-[168px]" style={{ color: temp <= 32 ? "#ff8a8a" : temp < 40 ? "#ffb774" : ink }}>
              {temp}°
            </p>
            <p className="tnum max-w-[300px] pb-2 text-xl leading-snug sm:text-[22px]" style={{ opacity: 0.9 }}>
              Firehouse expects <strong className="font-semibold">{Math.round(p.low) >= 100 ? "all 100 beds" : `${Math.round(p.low)}–${Math.round(p.high)} of 100 beds`}</strong> filled.
            </p>
          </div>

          {/* The slider: drag the night colder and watch everything downstream move. */}
          <div className="mt-5 max-w-[560px] rounded-2xl p-4" style={{ background: dark ? "rgba(255,255,255,0.08)" : "var(--surface)" }}>
            <label htmlFor="cold" className="flex justify-between text-[15px] font-semibold">
              <span>Drag tonight&apos;s low</span><span className="tnum">{temp}°F</span>
            </label>
            <input id="cold" type="range" min={0} max={60} value={temp} onChange={(e) => setTemp(Number(e.target.value))} className="mt-2 h-11 w-full cursor-grab accent-[var(--accent)]" />
            <div className="tnum flex justify-between text-xs" style={{ opacity: 0.7 }}><span>0°F</span><span>32° warming stations</span><span>40° Firehouse rule</span><span>60°F</span></div>
            <label htmlFor="rain" className="mt-3 flex justify-between text-[15px] font-semibold"><span>Chance of rain</span><span className="tnum">{rain}%</span></label>
            <input id="rain" type="range" min={0} max={100} step={5} value={rain} onChange={(e) => setRain(Number(e.target.value))} className="h-9 w-full cursor-grab accent-[var(--accent)]" />
            <button onClick={() => setSound(!sound)} aria-pressed={sound} className="press mt-1 rounded-full px-3 py-1.5 text-sm font-medium" style={{ background: dark ? "rgba(255,255,255,0.14)" : "var(--raised)" }}>
              {sound ? "Wind sound on" : "Turn on wind sound"}
            </button>
          </div>

          <ul className="mt-4 grid max-w-[560px] gap-2">
            {results.map((r) => (
              <li key={r.ruleId} className={`flex items-start gap-3 rounded-xl px-3.5 py-2.5 text-[15px] transition-all duration-300 ${r.fired ? "scale-[1.02] bg-warm text-white" : ""}`} style={r.fired ? undefined : { background: dark ? "rgba(255,255,255,0.06)" : "var(--surface)", opacity: 0.75 }}>
                <span className={`mt-1 size-2.5 shrink-0 rounded-full ${r.fired ? "breathe bg-white" : "bg-line"}`} />
                <span><strong className="font-semibold">{r.ruleId === "firehouse-day-extra" ? "Day shelter extra day" : "Warming stations likely"}: {r.fired ? "FIRES" : "not tonight"}.</strong> {r.reason}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid max-w-[560px] gap-2 sm:grid-cols-2">
            {routes.map((r) => (
              <div key={r.g} className="rounded-xl p-3.5" style={{ background: dark ? "rgba(255,255,255,0.08)" : "var(--surface)" }}>
                <p className="text-sm" style={{ opacity: 0.75 }}>A {r.g} at the door goes to</p>
                <p key={r.name} className="rise mt-0.5 text-[17px] font-semibold leading-snug">{r.name}</p>
                <p className="text-sm" style={{ opacity: 0.75 }}>{r.why}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link href={`/route${q}`} className="press rounded-full bg-accent px-6 py-3 text-[15px] font-semibold text-white hover:bg-accent-ink">Route a person tonight</Link>
            {!scenario && <Link href="/forecast?scenario=arctic" className="press rounded-full px-5 py-3 text-[15px] font-medium" style={{ background: dark ? "rgba(255,255,255,0.14)" : "var(--surface)" }}>Arctic-front scenario</Link>}
          </div>
        </div>

        <figure className={`card relative overflow-hidden text-ink ${over ? "shake ring-4 ring-negative" : ""}`}>
          {over && (
            <p className="breathe absolute inset-x-0 top-0 z-10 bg-negative py-2 text-center text-[17px] font-semibold text-white">
              OVER CAPACITY · about {Math.round(p.spill)} people with no bed
            </p>
          )}
          <div className="h-[320px] sm:h-[420px]">
            <ClientCanvas kind="beds" predicted={ps.predicted} high={ps.high} spill={ps.spill} />
          </div>
          <figcaption className="flex flex-wrap items-end justify-between gap-3 border-t border-line px-5 py-4">
            <div>
              <p className="tnum text-[40px] leading-none font-semibold tracking-[-0.02em]">{Math.round(p.predicted)}<span className="text-lg text-muted"> / 100 beds</span>{over && <span className="text-negative"> +{Math.round(p.spill)}</span>}</p>
              <p className="mt-1 text-sm text-muted">Firehouse, predicted. Each block is one bed. Model trained on SIMULATED history.</p>
            </div>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
