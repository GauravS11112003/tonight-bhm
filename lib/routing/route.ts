import type { Need, NightPrediction, RuleResult, Site } from "@/lib/types";

export type AgeBand = "under-18" | "18-24" | "25-54" | "55+";
export type Gender = "man" | "woman" | "nonbinary" | "prefer-not";

// What the volunteer confirmed. No name, no date of birth, no ID: on purpose.
export type Intake = {
  ageBand: AgeBand;
  gender: Gender;
  needsPlaceTonight: boolean;
  needs: Need[];
  flags: { mobility: boolean; medication: boolean; sickNow: boolean };
};

export type Tonight = {
  date: string;
  weekday: number; // 0 = Sunday
  lowF: number | null;
  results: RuleResult[]; // fired activations for tonight
  predictions: Record<string, NightPrediction | undefined>; // by site id; only Firehouse has a model
};

export type RankedSite = {
  site: Site;
  eligible: boolean;
  openTonight: boolean;
  passed: string[];
  failed: string[];
  caveats: string[];
  spare: number | null; // capacity − B̂, null when capacity is unverified
  warmingActive: boolean;
  needsMet: Need[];
  summary: string;
};

const GENDER_WORD: Record<Gender, string> = { man: "a man", woman: "a woman", nonbinary: "nonbinary", "prefer-not": "not stated" };
const NEED_WORD: Record<Need, string> = {
  shelter_tonight: "a bed tonight",
  warmth: "warmth",
  food: "food",
  medical: "medical care",
  showers: "showers",
  housing_longterm: "long-term housing",
};
export const needWord = (n: Need) => NEED_WORD[n];

function eligibility(site: Site, intake: Intake) {
  const passed: string[] = [];
  const failed: string[] = [];
  for (const rule of site.eligibility) {
    const v = intake[rule.field];
    if (rule.value.includes(v)) passed.push(`${rule.label} ✓`);
    else if (rule.field === "gender") failed.push(`${rule.label}; this person is ${GENDER_WORD[intake.gender]}`);
    else failed.push(`${rule.label}; this person is ${intake.ageBand === "under-18" ? "under 18" : intake.ageBand}`);
  }
  if (site.eligibility.length === 0) passed.push(site.eligibilityUnverified ? "Eligibility unverified — call" : "Open to everyone ✓");
  return { passed, failed };
}

function openTonight(site: Site, t: Tonight, intake: Intake): { open: boolean; why: string } {
  const fired = (id: string) => t.results.find((r) => r.ruleId === id);
  if (site.opens === "nightly") return { open: true, why: "Open nightly" };
  if (site.opens === "pathway") return { open: true, why: "Housing pathway, by phone" };
  if (site.opens.startsWith("rule:")) {
    const r = fired(site.opens.slice(5));
    return r?.fired
      ? { open: true, why: `Likely open tonight: ${r.reason}` }
      : { open: false, why: `Opens only on city-announced freezing nights. ${r?.reason ?? ""}`.trim() };
  }
  if (site.opens.startsWith("schedule-or-rule:")) {
    // A day shelter can only help someone who does not need an overnight bed.
    const r = fired(site.opens.slice(17));
    const scheduled = site.schedule?.days.includes(t.weekday) ?? false;
    const today = scheduled || r?.fired;
    if (intake.needsPlaceTonight) return { open: false, why: `Daytime only (${site.schedule?.hours}); not an overnight bed` };
    if (!today) return { open: false, why: "Not a day-shelter day today" };
    return { open: true, why: scheduled ? `Open today ${site.schedule?.hours}` : `Extra day today: ${r?.reason}` };
  }
  return { open: false, why: "Hours unverified — call" };
}

/**
 * Pure: rank where this person could go tonight, with the reasons.
 * The LLM never touches this. Eligibility is data, so every exclusion can be audited.
 */
export function route(intake: Intake, sites: Site[], tonight: Tonight): { ranked: RankedSite[]; excluded: RankedSite[] } {
  const cold = (tonight.lowF ?? 99) <= 40;
  const all: RankedSite[] = sites
    .filter((s) => s.type !== "pathway") // One Roof is always shown separately as a next step
    .map((site) => {
      const { passed, failed } = eligibility(site, intake);
      const o = openTonight(site, tonight, intake);
      (o.open ? passed : failed).push(o.why);
      const p = tonight.predictions[site.id];
      const spare = site.capacity !== null && p ? Math.max(0, Math.round(site.capacity - p.raw)) : null;
      const warmingActive = site.type === "warming" && o.open;
      const needsMet = intake.needs.filter((n) => site.meets.includes(n));
      const caveats: string[] = [];
      if (site.capacity === null && site.type !== "day") caveats.push("Capacity unverified — call ahead");
      if (p && p.spill > 0) caveats.push(`Predicted over capacity by about ${Math.round(p.spill)} people`);
      if (intake.flags.mobility) caveats.push("Accessibility unverified — call ahead");
      if (intake.flags.medication) caveats.push("Ask about storing medication");

      let summary = `${site.name}: ${failed.length ? "not a fit" : "eligible ✓"}`;
      if (p) summary += `, predicted ${Math.round(p.predicted)} of ${p.capacity} beds full tonight`;
      if (warmingActive) summary += ", warming station likely open 6 p.m.–7 a.m.";
      return { site, eligible: failed.length === 0, openTonight: o.open, passed, failed, caveats, spare, warmingActive, needsMet, summary };
    });

  const ranked = all
    .filter((r) => r.eligible && r.openTonight)
    .sort(
      (a, b) =>
        // 1. Predicted spare beds. Unknown capacity sorts as 0: we don't assume room we can't see.
        (b.spare ?? 0) - (a.spare ?? 0) ||
        // 2. An active warming station on a cold night.
        Number(cold && b.warmingActive) - Number(cold && a.warmingActive) ||
        // 3. How many of the confirmed needs it meets.
        b.needsMet.length - a.needsMet.length,
    );
  const excluded = all.filter((r) => !(r.eligible && r.openTonight));
  return { ranked, excluded };
}

export const FALLBACKS = [
  { name: "One Roof Coordinated Entry", phone: "(205) 254-8833", what: "Housing pathway. Not a bed tonight, but the way into housing." },
  { name: "2-1-1", phone: "211", what: "United Way 24-hour line for shelter, food and crisis help." },
];
