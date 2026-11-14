import Link from "next/link";
import Nav from "@/components/Nav";
import NotifyQueue from "@/components/NotifyQueue";
import { buildHub } from "@/lib/hub";
import { birminghamNow } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function NotifyPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const scenario = (await searchParams).scenario === "arctic";
  const { alerts, nights, source } = await buildHub(scenario);
  const q = scenario ? "?scenario=arctic" : "";
  return (
    <>
      <Nav active="/notify" scenario={scenario} source={source} />
      <main className="mx-auto max-w-[1180px] px-4 pt-6 pb-20 sm:px-8">
        <h1 className="rise text-[40px] leading-[1.02] sm:text-[56px]">The alert queue</h1>
        <p className="rise mt-3 max-w-[680px] text-[17px] leading-relaxed text-ink/85" style={{ ["--d" as string]: "80ms" }}>
          When an activation rule fires or the forecast passes capacity, the people who need lead time are queued an alert: shelter staff, warming-station operators, volunteers and donors. One alert per audience per night.
        </p>

        {alerts.length === 0 ? (
          <div className="card rise mt-8 p-6 sm:p-8" style={{ ["--d" as string]: "140ms" }}>
            <h2 className="display text-[30px] leading-tight">Nothing is queued this week</h2>
            <p className="mt-2 max-w-[620px] text-[16px] leading-relaxed text-ink/85">No activation rule fires and the forecast stays under capacity. Alerts queue themselves when a cold night enters the 7-day forecast.</p>
            <Link href="/notify?scenario=arctic" className="press mt-4 inline-flex min-h-11 items-center rounded-full bg-accent px-6 text-[15px] font-semibold text-white hover:bg-accent-ink">See it with the arctic-front scenario</Link>
          </div>
        ) : (
          <NotifyQueue alerts={alerts} days={nights.map((n) => n.day.date)} lows={nights.map((n) => n.day.lowF)} today={nights[0].day.date} nowHour={birminghamNow().hour} />
        )}

        <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="How notifying works">
          {[
            ["In-app only for now", "Send marks an alert as sent on this screen. No text message or email leaves the app; SMS is not connected."],
            ["Never to people seeking shelter", "The hub stores no phone number for anyone experiencing homelessness, so there is nobody of that kind to notify. Alerts go to organisations, volunteers and donors."],
            ["Rules, not AI", "Each alert names the rule or forecast that queued it. The wording is a template filled with the forecast numbers."],
          ].map(([t, b]) => (
            <div key={t} className="rounded-xl bg-raised p-5">
              <h2 className="font-semibold">{t}</h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink/85">{b}</p>
            </div>
          ))}
        </section>
        <p className="mt-6 text-sm text-muted">Volunteers answer the call from <Link href={`/team${q}`} className="text-accent underline underline-offset-2">the volunteer board</Link>; donors from <Link href={`/asks/public${q}`} className="text-accent underline underline-offset-2">the public needs board</Link>.</p>
      </main>
    </>
  );
}
