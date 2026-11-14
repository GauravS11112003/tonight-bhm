import Link from "next/link";
import AskFormulas from "@/components/AskFormulas";
import AsksBoard from "@/components/AsksBoard";
import { Mark, ScenarioBanner } from "@/components/Nav";
import { toPublic } from "@/lib/asks";
import { buildHub, SITES } from "@/lib/hub";

export const dynamic = "force-dynamic";

// The shareable board. Same cards as the staff board, minus staff notes and staff controls.
// A site whose location is confidential is never named here.
export default async function PublicAsks({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const scenario = (await searchParams).scenario === "arctic";
  const { asks } = await buildHub(scenario);
  const shown = asks.map((a) => toPublic(a, SITES.find((s) => s.id === a.siteId)));
  return (
    <>
      {scenario && <ScenarioBanner active="/asks/public" />}
      <header className="mx-auto flex max-w-[1320px] items-center gap-2.5 px-4 pt-5 pb-2 sm:px-8">
        <Mark /><span className="display text-[24px] leading-none">Tonight BHM</span>
      </header>
      <main className="mx-auto max-w-[1320px] px-4 pt-6 pb-20 sm:px-8">
        <h1 className="rise text-[40px] leading-[1.02] sm:text-[56px]">What Birmingham&rsquo;s shelters need this week</h1>
        <p className="rise mt-3 max-w-[680px] text-[17px] leading-relaxed text-ink/85" style={{ ["--d" as string]: "80ms" }}>
          Requests from Birmingham&rsquo;s homelessness coordination hub, sized from the weather forecast before the cold night arrives. Pledge what you can bring.
        </p>
        {shown.length === 0 && <p className="card rise mt-8 p-6 text-[16px] text-ink/85">No requests this week. They appear here when a cold night or a heat advisory enters the 7-day forecast.</p>}
        <AsksBoard asks={shown} internal={false} />
        <AskFormulas />
        <p className="mt-8 max-w-[720px] text-sm leading-relaxed text-muted">
          Tonight BHM is a coordination layer, not a replacement. For housing, One Roof Coordinated Entry is the path: (205) 254-8833. For programs and services, call 2-1-1 or search findhelp. <Link href="/about" className="text-accent underline underline-offset-2">How the numbers are made</Link>
        </p>
      </main>
    </>
  );
}
