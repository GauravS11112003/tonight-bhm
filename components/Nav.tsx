import Link from "next/link";
import type { ForecastSource } from "@/lib/types";

/** Mark: a roof over a crescent moon. Tonight, and a place to be. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M7 15.5 16 8l9 7.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.2 17.2a5 5 0 1 1-6.1 6.4 4 4 0 0 0 6.1-6.4Z" fill="#fff" />
    </svg>
  );
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function Nav({ active, scenario, source }: { active: "/" | "/forecast" | "/route" | "/team" | "/about"; scenario: boolean; source?: ForecastSource }) {
  const q = scenario ? "?scenario=arctic" : "";
  const links = [
    { href: "/", label: "City map" },
    { href: "/forecast", label: "Forecast" },
    { href: "/route", label: "Route a person" },
    { href: "/team", label: "Volunteers" },
    { href: "/about", label: "Method & data" },
  ] as const;
  return (
    <>
      {scenario && (
        <div className="bg-warm text-white">
          <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm sm:px-8">
            <p>
              <strong className="font-semibold">SCENARIO — not the live forecast.</strong> An arctic front overrides the next 3 nights (lows 28, 24, 31°F with rain).
            </p>
            <Link href={active} className="press rounded-full bg-white/15 px-3 py-1 font-medium hover:bg-white/25">
              Back to live forecast
            </Link>
          </div>
        </div>
      )}
      <header className="relative z-10">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-8 gap-y-3 px-4 pt-5 pb-2 sm:px-8">
          <Link href={`/${q}`} className="flex items-center gap-2.5" aria-label="Tonight BHM home">
            <Mark />
            <span className="display text-[24px] leading-none">Tonight BHM</span>
          </Link>
          <nav className="flex gap-1 text-sm" aria-label="Main">
            {links.map((l) => (
              <Link
                key={l.href}
                href={`${l.href}${q}`}
                aria-current={active === l.href ? "page" : undefined}
                className={`press rounded-full px-3 py-1.5 ${active === l.href ? "bg-raised font-medium text-ink" : "text-muted hover:text-ink"}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {source && (
              <span
                className={`tnum rounded-full px-2.5 py-1 ${source.kind === "cached" ? "bg-warm-soft text-warm-ink" : source.kind === "scenario" ? "bg-warm-soft text-warm-ink" : "bg-positive-soft text-positive"}`}
                title={source.note}
              >
                {source.kind === "live" && <span className="breathe mr-1.5 inline-block size-1.5 rounded-full bg-positive align-middle" />}
                {source.kind === "live" ? `Live NWS · ${fmtTime(source.fetchedAt)}` : source.kind === "cached" ? `Cached forecast from ${fmtTime(source.fetchedAt)}` : "Scenario"}
              </span>
            )}
            <Link
              href={scenario ? active : `${active}?scenario=arctic`}
              className="press group flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 hover:border-accent-track"
              aria-pressed={scenario}
            >
              <span className={`relative h-5 w-9 rounded-full transition-colors ${scenario ? "bg-warm" : "bg-raised"}`}>
                <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${scenario ? "translate-x-4.5" : "translate-x-0.5"}`} />
              </span>
              Demo scenario: arctic front
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
