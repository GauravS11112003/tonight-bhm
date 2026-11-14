import Link from "next/link";
import Nav from "@/components/Nav";
import CountUp from "@/components/CountUp";
import LiveHero from "@/components/LiveHero";
import WeekChart from "@/components/WeekChart";
import PrepareSection from "@/components/PrepareSection";
import ModelArena from "@/components/ModelArena";
import { buildWeek } from "@/lib/plan";

// Reads the live forecast on each request (the weather client memoizes for 10 minutes).
export const dynamic = "force-dynamic";

/** The real Birmingham numbers, as one field of colour between the model and the footer. */
function WhyBand() {
  const facts = [
    { n: 29509, label: "shelter nights Firehouse provided in 2025" },
    { n: 92693, label: "meals Firehouse served in 2025" },
    { n: 911, label: "people counted homeless in Jefferson, Shelby and St. Clair (2024), up from 847" },
  ];
  return (
    <section className="mt-16 bg-accent-ink px-4 py-14 text-white sm:px-8 sm:py-20" aria-labelledby="why-h">
      <div className="mx-auto max-w-[1320px]">
        <h2 id="why-h" className="display text-[44px] leading-none sm:text-[56px]">Why it matters here</h2>
        <dl className="mt-10 grid gap-10 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="sr-only">{f.label}</dt>
              <dd className="display text-[64px] leading-none sm:text-[84px]"><CountUp value={f.n} /></dd>
              <dd className="mt-3 max-w-[300px] text-[16px] leading-snug text-white/80">{f.label}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-12 max-w-[820px] text-[22px] leading-snug text-white/90 sm:text-[26px]">
          Birmingham has two official warming stations, about $2,500 a night each, opened one cold snap at a time. People outside often hear last.
        </p>
      </div>
    </section>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const scenario = (await searchParams).scenario === "arctic";
  const { nights, source } = await buildWeek(scenario);
  const q = scenario ? "?scenario=arctic" : "";

  return (
    <>
      <Nav active="/forecast" scenario={scenario} source={source} />
      <main className="mx-auto max-w-[1320px] overflow-x-clip px-4 sm:px-8">
        <LiveHero day={nights[0].day} q={q} scenario={scenario} />
        <WeekChart nights={nights} />
        <PrepareSection nights={nights} q={q} />
        <ModelArena />
      </main>
      <WhyBand />
      <footer className="mx-auto flex max-w-[1320px] flex-wrap items-end justify-between gap-6 px-4 py-14 sm:px-8">
          <p className="display text-[52px] leading-none text-accent-ink sm:text-[76px]">See it coming.</p>
          <p className="max-w-[560px] text-sm leading-relaxed text-muted">
            Weather: National Weather Service, api.weather.gov. Firehouse figures: firehouseshelter.com. Warming stations: Birmingham Watch, Jan 30 2026.
            Bed predictions are aggregate, per shelter per night, from models trained on <strong className="text-ink">simulated</strong> history. Never about a person. <Link href={`/about${q}`} className="text-accent underline underline-offset-2">How it works</Link>
          </p>
        </footer>
    </>
  );
}
