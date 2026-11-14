"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MLMap, Marker, GeoJSONSource } from "maplibre-gl";
import ClientCanvas from "@/components/ClientCanvas";
import HubTiles, { type HubData } from "@/components/HubTiles";
import { Mark, NavLinks, NavStatus } from "@/components/Nav";
import type { TonightSite } from "@/lib/hub";
import type { ForecastSource } from "@/lib/types";
import { useVolunteerStore } from "@/components/useVolunteerStore";
import { REPORT_NEEDS, REPORT_TTL_MS, snap, type AreaReport } from "@/lib/volunteers/store";
import type { NightBrief } from "@/lib/volunteers/nights";

export type MapSite = TonightSite;

const DOWNTOWN: [number, number] = [-86.8104, 33.5145];
const NEED_LABEL: Record<(typeof REPORT_NEEDS)[number], string> = { blankets: "Blankets", food: "Food", medical: "Medical help", transport: "A ride to shelter" };
const STATUS = { open: { text: "Open tonight", color: "#1f7a4d" }, likely: { text: "Likely open tonight", color: "#b4530f" }, closed: { text: "Not open tonight", color: "#566476" } };

/** A small square on the ground around a point, so the map can raise it into a 3D column. */
function square(lng: number, lat: number, half = 0.00045) {
  const dx = half / Math.cos((lat * Math.PI) / 180);
  return [[[lng - dx, lat - half], [lng + dx, lat - half], [lng + dx, lat + half], [lng - dx, lat + half], [lng - dx, lat - half]]];
}

/** The hub home: the city in 3D, with the four verbs and tonight's places floating over it. */
export default function CityMap({ tonight, sites, scenario, source, hub, fired }: { tonight: NightBrief; sites: MapSite[]; scenario: boolean; source: ForecastSource; hub: HubData; fired: string[] }) {
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
  const focus = (s: MapSite) => {
    setSelected(s); setReporting(false);
    if (s.lat !== null && s.lng !== null) mapRef.current?.flyTo({ center: [s.lng, s.lat], zoom: 16, pitch: 64, duration: 1800 });
  };
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
  const panel = "float-panel lg:pointer-events-auto";

  return (
    <div className="relative flex min-h-dvh flex-col bg-ground pb-4 lg:block lg:h-dvh lg:min-h-[760px] lg:overflow-hidden lg:bg-raised lg:pb-0">
      <div className={`relative order-2 mt-3 h-[44dvh] min-h-[280px] overflow-hidden bg-raised lg:absolute lg:inset-0 lg:mt-0 lg:h-auto ${reporting ? "[&_canvas]:!cursor-crosshair" : ""}`}>
        <div ref={box} className="h-full w-full" aria-label="3D map of Birmingham showing shelters and outreach reports" role="application" />
        {cold && <ClientCanvas kind="particles" lowF={tonight.lowF} />}
        {failed && <p className="absolute inset-x-0 top-1/2 px-6 text-center text-muted">The map tiles could not load. Shelters and reports are still listed in the panels.</p>}
      </div>

      <div className="contents lg:pointer-events-none lg:absolute lg:inset-0 lg:flex lg:flex-col lg:gap-3 lg:p-4">
        {scenario && (
          <p className="order-0 bg-warm px-4 py-2.5 text-sm text-white lg:order-none lg:pointer-events-auto lg:rounded-xl">
            <strong className="font-semibold">SCENARIO — not the live forecast.</strong> An arctic front overrides the next 3 nights. <Link href="/" className="font-medium underline underline-offset-2">Back to live forecast</Link>
          </p>
        )}

        <header className={`${panel} rise order-1 mx-3 mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 lg:order-none lg:m-0`}>
          <Link href={`/${q}`} className="flex items-center gap-2.5"><Mark /><span className="display text-[24px] leading-none">Tonight BHM</span></Link>
          <NavLinks active="/" scenario={scenario} />
          <NavStatus active="/" scenario={scenario} source={source} />
        </header>

        <div className="contents lg:flex lg:min-h-0 lg:flex-1 lg:items-start lg:justify-between lg:gap-3">
          {/* Left: what the hub is, and tonight in one figure */}
          <section className={`${panel} rise order-3 mx-3 mt-3 p-5 lg:order-none lg:m-0 lg:w-full lg:max-w-[452px] lg:p-6`} style={{ ["--d" as string]: "200ms" }} aria-labelledby="hub-h">
            <h1 id="hub-h" className="text-[32px] leading-[1.04] sm:text-[38px]"><span className="sr-only">Tonight BHM — </span>Birmingham&rsquo;s homelessness coordination hub</h1>
            <div className="mt-4 flex items-end gap-4">
              <p className="display tnum text-[92px] leading-[0.8] lg:text-[104px]" style={{ color: (tonight.lowF ?? 99) <= 32 ? "var(--negative)" : cold ? "var(--warm)" : "var(--accent-ink)" }}>{tonight.lowF}°</p>
              <p className="pb-1 text-[15px] leading-snug text-ink/85">
                Tonight&rsquo;s low.{tonight.alerts.length ? ` ${tonight.alerts.join(", ")}.` : ""}{" "}
                <strong className={`font-semibold ${fired.length ? "text-warm-ink" : ""}`}>{fired.length} activation{fired.length === 1 ? "" : "s"} active</strong>
                {fired.length ? `: ${fired.join(", ").toLowerCase()}.` : "."}
              </p>
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-muted">
              A coordination layer, not a replacement. One Roof Coordinated Entry stays the housing path; findhelp and 2-1-1 stay the directory. The hub adds foresight and action before the cold night.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/route${q}`} className="press flex min-h-11 items-center rounded-full bg-accent px-5 text-[15px] font-semibold text-white hover:bg-accent-ink">Route a person</Link>
              <button onClick={() => { setReporting(!reporting); setDraft(null); setSelected(null); }} aria-pressed={reporting} className={`press min-h-11 rounded-full px-5 text-[15px] font-medium ${reporting ? "bg-negative text-white" : "bg-raised hover:bg-accent-track"}`}>
                {reporting ? "Cancel report" : "Report people outside"}
              </button>
            </div>
          </section>

          {/* Right: whatever the user is doing now */}
          <aside className={`${panel} rise order-6 mx-3 mt-3 p-5 lg:order-none lg:m-0 lg:w-full lg:max-w-[360px] lg:p-6`} style={{ ["--d" as string]: "320ms" }} aria-live="polite">
            {reporting ? (
              <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
                <h2 className="text-lg font-semibold">Report people outside</h2>
                <p className="mt-1 text-sm text-muted">{draft ? "Area chosen. The pin is rounded to about three blocks." : "Click the map where you saw them."}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[15px] font-semibold">How many people?</span>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Fewer" onClick={() => setCount(Math.max(1, count - 1))} className="press size-11 rounded-full bg-raised text-xl">−</button>
                    <span className="tnum w-8 text-center text-xl font-semibold">{count}</span>
                    <button type="button" aria-label="More" onClick={() => setCount(Math.min(50, count + 1))} className="press size-11 rounded-full bg-raised text-xl">+</button>
                  </div>
                </div>
                <fieldset className="mt-3"><legend className="text-[15px] font-semibold">What do they need?</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {REPORT_NEEDS.map((n) => (
                      <button key={n} type="button" aria-pressed={needs.includes(n)} onClick={() => setNeeds(needs.includes(n) ? needs.filter((x) => x !== n) : [...needs, n])} className={`press min-h-11 rounded-full px-3.5 text-sm font-medium ${needs.includes(n) ? "bg-accent text-white" : "bg-raised"}`}>{NEED_LABEL[n]}</button>
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
                  <button onClick={() => setSelected(null)} aria-label="Close" className="press size-11 shrink-0 rounded-full bg-raised">✕</button>
                </div>
                <p className="mt-2 inline-block rounded-full px-2.5 py-1 text-sm font-medium text-white" style={{ background: STATUS[selected.status].color }}>{STATUS[selected.status].text}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-ink/85">{selected.line}</p>
                {selected.beds && <p className="tnum mt-1 text-[15px] font-semibold">{selected.beds} beds predicted full</p>}
                <p className="mt-1 text-sm text-muted">{selected.address ?? "Address unverified — call"}</p>
                {selected.phone && <a href={`tel:${selected.phone.replace(/\D/g, "")}`} className="press tnum mt-3 inline-flex min-h-11 items-center rounded-full bg-accent-soft px-5 text-[15px] font-semibold text-accent-ink">Call {selected.phone}</a>}
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-semibold">Outreach reports, last 24 hours</h2>
                <p className="tnum mt-1 text-[15px] text-ink/85">{reports.length ? `${people} people across ${reports.length} area${reports.length === 1 ? "" : "s"}.` : "No reports yet. Volunteers add them from the map; each one is an area, never a person."}</p>
                <ul className="mt-2 grid max-h-[176px] gap-1.5 overflow-y-auto">
                  {reports.map((r) => (
                    <li key={r.id}>
                      <button onClick={() => mapRef.current?.flyTo({ center: [r.lng, r.lat], zoom: 16, pitch: 64, duration: 1600 })} className="press flex min-h-11 w-full items-center gap-3 rounded-xl bg-raised px-3 py-2 text-left hover:bg-accent-track">
                        <span className={`tnum flex size-9 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white ${r.sample ? "bg-[#e08a3c]" : "bg-negative"}`}>{r.count}</span>
                        <span className="min-w-0"><span className="block truncate text-[15px] font-medium">{r.note || "Area report"}</span><span className="block truncate text-xs text-muted">{r.needs.map((n) => NEED_LABEL[n]).join(", ") || "No needs listed"}</span></span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => send({ action: "sampleReports" })} className="press min-h-11 rounded-full bg-raised px-4 text-sm font-medium hover:bg-accent-track">Load SAMPLE reports</button>
                  {reports.length > 0 && <button onClick={() => send({ action: "clearReports" })} className="press min-h-11 rounded-full bg-raised px-4 text-sm font-medium hover:bg-accent-track">Clear</button>}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted">Orange columns are SAMPLE data for the demo. Red columns are reports sent from this app.</p>
              </div>
            )}
          </aside>
        </div>

        <HubTiles data={hub} store={store} q={q} />

        {/* Tonight: which places are open, the room predicted at each, which warming stations are active */}
        <section className={`${panel} rise order-5 mx-3 mt-3 flex flex-col gap-x-5 gap-y-2 px-4 py-3 lg:order-none lg:m-0 lg:mr-12 lg:flex-row lg:items-center lg:px-5`} style={{ ["--d" as string]: "780ms" }} aria-labelledby="tonight-h">
          <h2 id="tonight-h" className="display shrink-0 text-[24px] leading-none">Tonight</h2>
          <ul className="grid flex-1 gap-1.5 sm:grid-cols-2 lg:flex lg:gap-2">
            {sites.map((s) => (
              <li key={s.id} className="min-w-0 lg:flex-1">
                <button onClick={() => focus(s)} className="press flex min-h-11 w-full items-center gap-2.5 rounded-xl bg-raised px-3 py-1.5 text-left hover:bg-accent-track">
                  <i aria-hidden className={`size-2.5 shrink-0 rounded-full ${s.status === "likely" ? "breathe" : ""}`} style={{ background: STATUS[s.status].color }} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold leading-tight">{s.short}</span>
                    <span className="tnum block truncate text-xs leading-tight text-muted"><span className="sr-only">{STATUS[s.status].text}. </span>{s.room}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
