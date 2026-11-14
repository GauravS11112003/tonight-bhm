import type { ForecastDay, NightPrediction, RuleResult, Site } from "@/lib/types";

// The needs board. Every number here is a formula a person can check by hand.
// No AI: an ask is the forecast times a multiplier, with the reason printed beside it.
// The multipliers are ASSUMPTIONS until shelter staff confirm them.
export const ASK_FORMULAS = {
  blanketsPerPerson: 1.5, // on nights with a low below blanketBelowF
  blanketBelowF: 40,
  waterPerPerson: 3, // bottles, on days with a Heat Advisory
  waterAlert: "Heat Advisory",
  peoplePerVolunteer: 25, // one volunteer per 25 people, rounded up
  mealsPerPerson: 3,
};

export const ASK_KINDS = ["blankets", "water", "volunteers", "meals"] as const;
export type AskKind = (typeof ASK_KINDS)[number];
export type AskStatus = "open" | "pledged" | "fulfilled";
export const ASK_LABEL: Record<AskKind, { one: string; many: string; formula: string }> = {
  blankets: { one: "blanket", many: "blankets", formula: `predicted people × ${ASK_FORMULAS.blanketsPerPerson}, on nights below ${ASK_FORMULAS.blanketBelowF}°F` },
  water: { one: "water bottle", many: "water bottles", formula: `predicted people × ${ASK_FORMULAS.waterPerPerson}, on Heat Advisory days` },
  volunteers: { one: "volunteer", many: "volunteers", formula: `predicted people ÷ ${ASK_FORMULAS.peoplePerVolunteer}, rounded up` },
  meals: { one: "meal", many: "meals", formula: `predicted people × ${ASK_FORMULAS.mealsPerPerson}` },
};

export type Ask = {
  id: string; // stable: scope, site, night and kind
  kind: AskKind;
  qty: number;
  siteId: string;
  siteName: string;
  date: string;
  night: string; // "tonight", "Tuesday"
  byWhen: string; // "by Tuesday night"
  why: string;
  people: number;
  lowF: number | null;
};

/** Pure: the four quantities for one night at one shelter. Zero means "no ask". */
export function quantities(people: number, lowF: number | null, alerts: string[]): Record<AskKind, number> {
  const f = ASK_FORMULAS;
  const cold = lowF !== null && lowF < f.blanketBelowF;
  const heat = alerts.some((a) => a.toLowerCase() === f.waterAlert.toLowerCase());
  return {
    blankets: cold ? Math.ceil(people * f.blanketsPerPerson) : 0,
    water: heat ? people * f.waterPerPerson : 0,
    volunteers: Math.ceil(people / f.peoplePerVolunteer),
    meals: people * f.mealsPerPerson,
  };
}

/** People the model expects to need a bed, including those beyond capacity. A total, never a person. */
export const expectedPeople = (p: NightPrediction) => Math.round(p.predicted + p.spill);

type NightLike = { day: ForecastDay; results: RuleResult[]; prediction: NightPrediction };
/** A night is flagged when an activation rule fires or the model predicts more people than beds. */
export const isFlagged = (n: NightLike) => n.results.some((r) => r.fired) || n.prediction.spill >= 1;

const weekday = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

/**
 * Pure: the asks for one shelter over the forecast week. Only shelters with a
 * demand forecast get asks; we never guess a quantity for a site we cannot predict.
 */
export function buildAsks(nights: NightLike[], site: Pick<Site, "id" | "name">, scope = "live"): Ask[] {
  const asks: Ask[] = [];
  nights.forEach((n, i) => {
    if (!isFlagged(n)) return;
    const people = expectedPeople(n.prediction);
    const q = quantities(people, n.day.lowF, n.day.alerts);
    const name = weekday(n.day.date);
    const night = i === 0 ? "tonight" : name;
    const over = n.prediction.spill >= 1 ? ", over capacity" : "";
    const heat = n.day.alerts.find((a) => a.toLowerCase() === ASK_FORMULAS.waterAlert.toLowerCase());
    const lead = heat && !(n.day.lowF !== null && n.day.lowF < ASK_FORMULAS.blanketBelowF) ? `${heat} ${name}` : `Low of ${n.day.lowF}°F ${name}`;
    for (const kind of ASK_KINDS) {
      if (q[kind] <= 0) continue;
      asks.push({
        id: `${scope}:${site.id}:${n.day.date}:${kind}`,
        kind, qty: q[kind], siteId: site.id, siteName: site.name, date: n.day.date, night,
        byWhen: i === 0 ? "by tonight" : `by ${name} night`,
        why: `${lead}; ~${people} people predicted${over}`,
        people, lowF: n.day.lowF,
      });
    }
  });
  return asks;
}

/**
 * What the shareable page may show. Internal notes never leave the server, and a site
 * whose location is confidential (for example a domestic-violence shelter) is not named.
 */
export function toPublic(ask: Ask, site?: Pick<Site, "confidentialLocation">): Ask {
  return site?.confidentialLocation ? { ...ask, siteId: "confidential", siteName: "A confidential-location shelter" } : ask;
}

export const askText = (a: Pick<Ask, "qty" | "kind">) => `${a.qty.toLocaleString("en-US")} ${a.qty === 1 ? ASK_LABEL[a.kind].one : ASK_LABEL[a.kind].many}`;
