import Nav from "@/components/Nav";
import RouteFlow from "@/components/RouteFlow";
import { buildWeek } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default async function RoutePage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const scenario = (await searchParams).scenario === "arctic";
  const { nights, source } = await buildWeek(scenario);
  const t = nights[0];
  return (
    <>
      <Nav active="/route" scenario={scenario} source={source} />
      <main className="mx-auto max-w-[1080px] px-4 pt-6 pb-20 sm:px-8">
        <RouteFlow
          tonight={{
            date: t.day.date,
            weekday: new Date(t.day.date + "T12:00:00Z").getUTCDay(),
            lowF: t.day.lowF,
            results: t.results,
            predictions: { "firehouse-shelter": t.prediction },
          }}
        />
      </main>
    </>
  );
}
