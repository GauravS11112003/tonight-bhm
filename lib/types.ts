// Shared shapes. Kept in one file so the whole data model fits on one screen.

export type ForecastDay = {
  date: string; // YYYY-MM-DD, local Birmingham date the night starts on
  name: string; // "Tonight", "Sunday", ...
  lowF: number | null; // overnight low starting this date
  highF: number | null; // daytime high on this date
  precipProb: number; // 0..1, max over the day and night
  alerts: string[]; // NWS alert event names overlapping this night
  shortForecast: string;
};

export type ForecastSource = {
  kind: "live" | "cached" | "scenario";
  fetchedAt: string; // ISO
  note?: string;
};

export type Condition = {
  field: "lowF" | "highF" | "precipProb" | "alerts";
  op: "<" | "<=" | ">" | ">=" | "includes";
  value: number | string;
};

export type Rule = {
  id: string;
  label: string;
  short: string;
  kind: "policy" | "assumption";
  match: "any" | "all";
  conditions: Condition[];
  source: string;
  note: string;
};

export type RuleResult = { ruleId: string; fired: boolean; reason: string };

export type Need = "shelter_tonight" | "warmth" | "food" | "medical" | "showers" | "housing_longterm";

export type EligibilityRule = {
  field: "gender" | "ageBand";
  op: "in";
  value: string[];
  label: string;
};

export type Site = {
  id: string;
  name: string;
  type: "shelter" | "warming" | "day" | "cooling" | "pathway";
  capacity: number | null;
  eligibility: EligibilityRule[];
  eligibilityUnverified?: boolean;
  confidentialLocation?: boolean; // e.g. a domestic-violence shelter: never shown on a map, strip or public page
  opens: string; // "nightly" | "rule:<id>" | "schedule-or-rule:<id>" | "pathway"
  schedule?: { days: number[]; hours: string };
  hours: string | null;
  meets: Need[];
  lowBarrier: boolean | null;
  address: string | null;
  lat: number | null; // geocoded from the address via OpenStreetMap; null when the address is unverified
  lng: number | null;
  phone: string | null;
  sourceUrl: string | null; // null = no public source found yet
  verifiedAt: string;
  notes: string;
};

export type NightPrediction = {
  date: string;
  predicted: number; // clipped 0..capacity
  raw: number; // unclipped B-hat
  low: number; // 80% band, clipped
  high: number;
  spill: number; // max(0, raw - capacity)
  capacity: number;
  model?: "ols" | "gbm"; // which model produced this (the backtest champion)
  challenger?: number; // the other model's raw prediction, shown for comparison
};
