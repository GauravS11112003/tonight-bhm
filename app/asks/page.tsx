import Link from "next/link";
import AskFormulas from "@/components/AskFormulas";
import AsksBoard from "@/components/AsksBoard";
import Nav from "@/components/Nav";
import { buildHub } from "@/lib/hub";

export const dynamic = "force-dynamic";

export default async function AsksPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const scenario = (await searchParams).scenario === "arctic";
  const { asks, source } = await buildHub(scenario);
  const q = scenario ? "?scenario=arctic" : "";
  return (
    <>
      <Nav active="/asks" scenario={scenario} source={source} />
      <main className="mx-auto max-w-[1320px] px-4 pt-6 pb-20 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="rise text-[40px] leading-[1.02] sm:text-[56px]">The needs board</h1>
            <p className="rise mt-3 max-w-[660px] text-[17px] leading-relaxed text-ink/85" style={{ ["--d" as string]: "80ms" }}>
              The forecast, turned into specific requests: what, how many, which shelter, by when, and why. Pledge one and the pile fills in.
            </p>
          </div>
          <Link href={`/asks/public${q}`} className="rise press flex min-h-11 items-center rounded-full bg-raised px-5 text-[15px] font-medium hover:bg-accent-track" style={{ ["--d" as string]: "120ms" }}>Open the shareable public board</Link>
        </div>

        {asks.length === 0 && (
          <div className="card rise mt-8 p-6 sm:p-8" style={{ ["--d" as string]: "140ms" }}>
            <h2 className="display text-[30px] leading-tight">Nothing to ask for this week</h2>
            <p className="mt-2 max-w-[620px] text-[16px] leading-relaxed text-ink/85">No activation rule fires and the forecast stays under capacity, so no night is flagged. Requests appear here the moment a cold night enters the 7-day forecast.</p>
            <Link href="/asks?scenario=arctic" className="press mt-4 inline-flex min-h-11 items-center rounded-full bg-accent px-6 text-[15px] font-semibold text-white hover:bg-accent-ink">See it with the arctic-front scenario</Link>
          </div>
        )}
        <AsksBoard asks={asks} internal />
        <AskFormulas />
      </main>
    </>
  );
}
