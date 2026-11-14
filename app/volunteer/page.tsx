import VolunteerApp from "@/components/VolunteerApp";
import { buildWeek } from "@/lib/plan";
import { toBrief } from "@/lib/volunteers/nights";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tonight BHM · Volunteer" };

export default async function VolunteerPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const scenario = (await searchParams).scenario === "arctic";
  const { nights } = await buildWeek(scenario);
  return <VolunteerApp nights={nights.map(toBrief)} scenario={scenario} />;
}
