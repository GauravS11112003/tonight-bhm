"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MLMap, Marker, GeoJSONSource } from "maplibre-gl";
import ClientCanvas from "@/components/ClientCanvas";
import { Mark } from "@/components/Nav";
import { useVolunteerStore } from "@/components/useVolunteerStore";
import { REPORT_NEEDS, REPORT_TTL_MS, snap, type AreaReport } from "@/lib/volunteers/store";
import type { NightBrief } from "@/lib/volunteers/nights";

export type MapSite = {
  id: string; name: string; short: string; lat: number | null; lng: number | null;
  status: "open" | "likely" | "closed"; line: string; phone: string | null; address: string | null; beds?: string;
};

const DOWNTOWN: [number, number] = [-86.8104, 33.5145];
const NEED_LABEL: Record<(typeof REPORT_NEEDS)[number], string> = { blankets: "Blankets", food: "Food", medical: "Medical help", transport: "A ride to shelter" };
const STATUS = { open: { text: "Open tonight", color: "#1f7a4d" }, likely: { text: "Likely open tonight", color: "#b4530f" }, closed: { text: "Not open tonight", color: "#566476" } };

/** A small square on the ground around a point, so the map can raise it into a 3D column. */
function square(lng: number, lat: number, half = 0.00045) {
  const dx = half / Math.cos((lat * Math.PI) / 180);
  return [[[lng - dx, lat - half], [lng + dx, lat - half], [lng + dx, lat + half], [lng - dx, lat + half], [lng - dx, lat - half]]];
}

export default function CityMap({ tonight, week, sites, scenario }: { tonight: NightBrief; week: NightBrief[]; sites: MapSite[]; scenario: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<MapSite | null>(null);
  const [reporting, setReporting] = useState(false);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [count, setCount] = useState(1);
  const [needs, setNeeds] = useState<AreaReport["needs"]>([]);
  const [note, setNote] = useState("");
  const { store, send } = useVolunteerStore(3000);
  const q = scenario ? "?scenario=arctic" : "";

  // Only the last 24 hours. Old reports stop being true and should not linger on a map.
  const reports = useMemo(() => (store.reports ?? []).filter((r) => Date.now() - Date.parse(r.at) < REPORT_TTL_MS), [store.reports]);
  const people = reports.reduce((s, r) => s + r.count, 0);
  const signedUp = store.signups.filter((s) => s.date === tonight.date).length;
  const reportingRef = useRef(false);
  reportingRef.current = reporting;

  // Build the map once.
  useEffect(() => {
    let dead = false;
    let orbit = 0;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (dead || !box.current) return;
      const map = new maplibregl.Map({
        container: box.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: DOWNTOWN, zoom: 11.2, pitch: 0, bearing: 0,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.on("error", () => { if (!map.isStyleLoaded()) setFailed(true); });
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

      map.on("load", () => {
        // Every building in Birmingham, raised to its real height, tinted by height.
        map.addLayer({
          id: "buildings-3d", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 12.5,
          paint: {
            "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 8], 0, "#edf1f6", 30, "#d9e3ef", 90, "#b3c8e3", 180, "#7fa2d2", 260, "#3f6fb5"],
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
            "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
            "fill-extrusion-opacity": 0.9,
          },
        });
        map.setLight({ anchor: "viewport", color: "#ffffff", intensity: 0.45, position: [1.4, 210, 35] });
        map.addSource("reports", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "report-columns", type: "fill-extrusion", source: "reports",
          paint: { "fill-extrusion-color": ["case", ["get", "sample"], "#e08a3c", "#c2373c"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.85 },
        });
        map.addSource("site-beacons", {
          type: "geojson",
          data: { type: "FeatureCollection", features: sites.filter((s) => s.lat !== null).map((s) => ({ type: "Feature", properties: { c: STATUS[s.status].color }, geometry: { type: "Polygon", coordinates: square(s.lng!, s.lat!, 0.00028) } })) },
        });
        map.addLayer({ id: "site-beacons", type: "fill-extrusion", source: "site-beacons", paint: { "fill-extrusion-color": ["get", "c"], "fill-extrusion-height": 260, "fill-extrusion-opacity": 0.8 } });

        // Site labels: one per address (the two Firehouse programs share a building).
        const seen = new Set<string>();
        for (const s of sites) {
          if (s.lat === null || s.lng === null || seen.has(`${s.lat},${s.lng}`)) continue;
          seen.add(`${s.lat},${s.lng}`);
          const el = document.createElement("button");
          el.className = "site-pin";
          el.innerHTML = `<i style="background:${STATUS[s.status].color}"></i><b>${s.short}</b>${s.beds ? `<span>${s.beds}</span>` : ""}`;
          el.onclick = (e) => { e.stopPropagation(); setSelected(s); setReporting(false); map.flyTo({ center: [s.lng!, s.lat!], zoom: 16, pitch: 64, duration: 1800 }); };
          new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -34] }).setLngLat([s.lng, s.lat]).addTo(map);
        }

        map.on("click", (e) => {
          if (!reportingRef.current) return;
          setDraft({ lat: snap(e.lngLat.lat), lng: snap(e.lngLat.lng) });
        });

        setReady(true);
        // Arrive from above, tilt into the city, then drift slowly until someone touches the map.
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) { map.jumpTo({ center: DOWNTOWN, zoom: 14.4, pitch: 60, bearing: -24 }); return; }
        map.flyTo({ center: DOWNTOWN, zoom: 14.4, pitch: 62, bearing: -24, duration: 5200, essential: true });
        let touched = false;
        const stop = () => { touched = true; cancelAnimationFrame(orbit); };
        ["mousedown", "touchstart", "wheel"].forEach((ev) => map.getCanvas().addEventListener(ev, stop, { once: true }));
        map.once("moveend", () => {
          const spin = () => { if (touched) return; map.setBearing(map.getBearing() + 0.035); orbit = requestAnimationFrame(spin); };
          spin();
        });
      });
    })().catch(() => setFailed(true));
    return () => { dead = true; cancelAnimationFrame(orbit); mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep report columns and their count bubbles in step with the store.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("reports") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: reports.map((r) => ({ type: "Feature", properties: { h: 60 + r.count * 28, sample: !!r.sample }, geometry: { type: "Polygon", coordinates: square(r.lng, r.lat) } })),
    });
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    import("maplibre-gl").then(({ default: maplibregl }) => {
      for (const r of reports) {
        const el = document.createElement("div");
        el.className = `report-pin${r.sample ? " sample" : ""}`;
        el.innerHTML = `<b>${r.count}</b>`;
        el.title = `${r.count} people reported in this area${r.sample ? " (sample)" : ""}`;
        markers.current.push(new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([r.lng, r.lat]).addTo(map));
      }
      if (draft) {
        const el = document.createElement("div");
        el.className = "report-pin draft";
        el.innerHTML = "<b>+</b>";
        markers.current.push(new maplibregl.Marker({ element: el }).setLngLat([draft.lng, draft.lat]).addTo(map));
      }
    });
  }, [reports, ready, draft]);

  async function submit() {
    if (!draft) return;
    if (await send({ action: "report", lat: draft.lat, lng: draft.lng, count, needs, note })) {
      setDraft(null); setReporting(false); setCount(1); setNeeds([]); setNote("");
    }
  }

  const cold = (tonight.lowF ?? 99) < 40;
  const panel = "pointer-events-auto float-panel";

  return (
    <div className="relative h-dvh min-h-[640px] w-full overflow-hidden bg-raised">
      <div className={`absolute inset-0 ${reporting ? "[&_canvas]:!cursor-crosshair" : ""}`}>
        <div ref={box} className="h-full w-full" aria-label="3D map of Birmingham showing shelters and outreach reports" role="application" />
      </div>
      {cold && <ClientCanvas kind="particles" lowF={tonight.lowF} />}
      {failed && <p className="absolute inset-x-0 top-1/2 text-center text-muted">The map tiles could not load. Shelters and reports are still listed in the panels.</p>}

      <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-3 sm:p-4">
        {scenario && <p className="pointer-events-auto rounded-xl bg-warm px-4 py-2 text-sm font-medium text-white">SCENARIO — not the live forecast. <Link href="/" className="underline">Back to live</Link></p>}

        <header className={`${panel} rise flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5`}>
          <Link href={`/${q}`} className="flex items-center gap-2.5"><Mark /><span className="display text-[24px] leading-none">Tonight BHM</span></Link>
          <nav className="flex flex-wrap gap-1 text-sm" aria-label="Main">
            {[["/forecast", "Forecast"], ["/route", "Route a person"], ["/team", "Volunteers"], ["/about", "Method & data"]].map(([h, l]) => (
              <Link key={h} href={`${h}${q}`} className="press rounded-full px-3 py-1.5 text-muted hover:bg-raised hover:text-ink">{l}</Link>
            ))}
          </nav>
          <span className="tnum ml-auto rounded-full bg-positive-soft px-2.5 py-1 text-sm text-positive"><span className="breathe mr-1.5 inline-block size-1.5 rounded-full bg-positive align-middle" />Live NWS forecast</span>
        </header>

        <div className="flex min-h-0 flex-1 flex-col justify-between gap-3 lg:flex-row lg:items-start">
          {/* Left: the city's night in one panel */}
          <section className={`${panel} rise w-full max-w-[410px] p-6`} style={{ ["--d" as string]: "200ms" }} aria-labelledby="city-h">
            <h1 id="city-h" className="text-[40px] leading-[1]">Birmingham, tonight</h1>
            <div className="mt-3 flex items-end gap-4">
              <p className="display tnum text-[112px] leading-[0.8]" style={{ color: (tonight.lowF ?? 99) <= 32 ? "var(--negative)" : cold ? "var(--warm)" : "var(--accent-ink)" }}>{tonight.lowF}°</p>
              <p className="pb-1 text-[15px] leading-snug text-ink/85">
                Overnight low.{tonight.alerts.length ? ` ${tonight.alerts.join(", ")}.` : ""} Firehouse expects <strong className="tnum">{tonight.low}–{tonight.high} of 100</strong> beds filled.
              </p>
            </div>
            <dl className="mt-5 grid grid-cols-3 divide-x divide-line border-y border-line py-3">
              {[[people, "people reported outside"], [reports.length, "areas reported"], [`${signedUp}/${tonight.needed}`, "volunteers tonight"]].map(([n, l]) => (
                <div key={l as string} className="px-3 first:pl-0">
                  <dd className="display tnum text-[38px] leading-none text-ink">{n}</dd>
                  <dt className="label mt-1.5">{l}</dt>
                </div>
              ))}
            </dl>
            <ul className="mt-4 grid gap-1.5 text-[14px]">
              <li className={`rounded-lg px-3 py-2 ${tonight.dayExtra ? "bg-warm-soft text-warm-ink" : "bg-raised text-muted"}`}><strong className="font-semibold">Firehouse day shelter extra day:</strong> {tonight.dayExtra ? "fires" : "not tonight"}</li>
              <li className={`rounded-lg px-3 py-2 ${tonight.warming ? "bg-warm text-white" : "bg-raised text-muted"}`}><strong className="font-semibold">City warming stations:</strong> {tonight.warming ? "likely (assumption)" : "not expected"}</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => { setReporting(!reporting); setDraft(null); setSelected(null); }} aria-pressed={reporting} className={`press min-h-11 rounded-full px-5 text-[15px] font-semibold ${reporting ? "bg-negative text-white" : "bg-accent text-white hover:bg-accent-ink"}`}>
                {reporting ? "Cancel report" : "Report people outside"}
              </button>
              <Link href={`/route${q}`} className="press flex min-h-11 items-center rounded-full bg-raised px-5 text-[15px] font-medium hover:bg-accent-track">Route a person</Link>
            </div>
          </section>

          {/* Right: whatever the user is doing now */}
          <aside className={`${panel} rise w-full max-w-[380px] p-6`} style={{ ["--d" as string]: "320ms" }} aria-live="polite">
            {reporting ? (
              <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
                <h2 className="text-lg font-semibold">Report people outside</h2>
                <p className="mt-1 text-sm text-muted">{draft ? "Area chosen. The pin is rounded to about three blocks." : "Click the map where you saw them."}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[15px] font-semibold">How many people?</span>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Fewer" onClick={() => setCount(Math.max(1, count - 1))} className="press size-10 rounded-full bg-raised text-xl">−</button>
                    <span className="tnum w-8 text-center text-xl font-semibold">{count}</span>
                    <button type="button" aria-label="More" onClick={() => setCount(Math.min(50, count + 1))} className="press size-10 rounded-full bg-raised text-xl">+</button>
                  </div>
                </div>
                <fieldset className="mt-3"><legend className="text-[15px] font-semibold">What do they need?</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {REPORT_NEEDS.map((n) => (
                      <button key={n} type="button" aria-pressed={needs.includes(n)} onClick={() => setNeeds(needs.includes(n) ? needs.filter((x) => x !== n) : [...needs, n])} className={`press min-h-10 rounded-full px-3.5 text-sm font-medium ${needs.includes(n) ? "bg-accent text-white" : "bg-raised"}`}>{NEED_LABEL[n]}</button>
                    ))}
                  </div>
                </fieldset>
                <label htmlFor="rep-note" className="mt-3 block text-[15px] font-semibold">Note for outreach</label>
                <input id="rep-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Under the overpass, two tents" className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-ground px-3 text-[15px] outline-none focus:border-accent" />
                <button disabled={!draft} className="press mt-4 min-h-11 w-full rounded-full bg-accent text-[15px] font-semibold text-white disabled:opacity-40">Send report</button>
                <p className="mt-3 text-xs leading-relaxed text-muted">An area, never a person. No names or photos. Locations are rounded to about 300 m and reports disappear after 24 hours.</p>
              </form>
            ) : selected ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold leading-snug">{selected.name}</h2>
                  <button onClick={() => setSelected(null)} aria-label="Close" className="press size-8 shrink-0 rounded-full bg-raised">✕</button>
                </div>
                <p className="mt-2 inline-block rounded-full px-2.5 py-1 text-sm font-medium text-white" style={{ background: STATUS[selected.status].color }}>{STATUS[selected.status].text}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-ink/85">{selected.line}</p>
                {selected.beds && <p className="tnum mt-1 text-[15px] font-semibold">{selected.beds} beds predicted full</p>}
                <p className="mt-1 text-sm text-muted">{selected.address}</p>
                {selected.phone && <a href={`tel:${selected.phone.replace(/\D/g, "")}`} className="press tnum mt-3 inline-flex min-h-11 items-center rounded-full bg-accent-soft px-5 text-[15px] font-semibold text-accent-ink">Call {selected.phone}</a>}
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-semibold">Outreach reports, last 24 hours</h2>
                {reports.length === 0 && <p className="mt-2 text-[15px] text-muted">No reports yet. Volunteers add them from the map; each one is an area, never a person.</p>}
                <ul className="mt-2 grid max-h-[220px] gap-1.5 overflow-y-auto">
                  {reports.map((r) => (
                    <li key={r.id}>
                      <button onClick={() => mapRef.current?.flyTo({ center: [r.lng, r.lat], zoom: 16, pitch: 64, duration: 1600 })} className="press flex w-full items-center gap-3 rounded-xl bg-raised px-3 py-2 text-left hover:bg-accent-track">
                        <span className={`tnum flex size-9 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white ${r.sample ? "bg-[#e08a3c]" : "bg-negative"}`}>{r.count}</span>
                        <span className="min-w-0"><span className="block truncate text-[15px] font-medium">{r.note || "Area report"}</span><span className="block truncate text-xs text-muted">{r.needs.map((n) => NEED_LABEL[n]).join(", ") || "No needs listed"}</span></span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => send({ action: "sampleReports" })} className="press rounded-full bg-raised px-3.5 py-2 text-sm font-medium hover:bg-accent-track">Load SAMPLE reports</button>
                  {reports.length > 0 && <button onClick={() => send({ action: "clearReports" })} className="press rounded-full bg-raised px-3.5 py-2 text-sm font-medium hover:bg-accent-track">Clear</button>}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted">Orange columns are sample data for the demo. Red columns are reports sent from this app. Not on the map: Pathways and First Light (address unverified — call).</p>
              </div>
            )}
          </aside>
        </div>

        {/* Bottom: the week, at a glance */}
        <Link href={`/forecast${q}`} className={`${panel} rise press hidden items-end gap-4 px-5 py-3 sm:flex`} style={{ ["--d" as string]: "440ms" }}>
          <span className="display pb-0.5 text-[22px] leading-none">Next 7 nights</span>
          <span className="flex flex-1 items-end gap-2">
            {week.map((n, i) => (
              <span key={n.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="relative block h-7 w-full overflow-hidden rounded-full bg-accent-track/70">
                  <span className="grow-x absolute inset-y-0 left-0 block rounded-full bg-accent" style={{ width: `${n.predicted}%`, ["--d" as string]: `${600 + i * 70}ms` }} />
                </span>
                <span className="tnum text-xs text-muted">{n.label.slice(0, 3)} · {n.lowF}° · {n.predicted} beds</span>
              </span>
            ))}
          </span>
          <span className="pb-1 text-sm font-medium text-accent">Open forecast →</span>
        </Link>
      </div>
    </div>
  );
}
