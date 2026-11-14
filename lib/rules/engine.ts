import rulesJson from "@/data/activation_rules.json";
import type { Condition, ForecastDay, Rule, RuleResult } from "@/lib/types";

export const RULES = rulesJson as Rule[];

const FIELD_LABEL: Record<Condition["field"], string> = {
  lowF: "Low",
  highF: "High",
  precipProb: "Chance of rain",
  alerts: "Alerts",
};
const OP_WORDS: Record<string, string> = { "<": "below", "<=": "at or below", ">": "above", ">=": "at or above" };

function check(day: ForecastDay, c: Condition): { ok: boolean; text: string } {
  if (c.op === "includes") {
    const ok = day.alerts.some((a) => a.toLowerCase() === String(c.value).toLowerCase());
    return { ok, text: ok ? `NWS issued a ${c.value}.` : `No ${c.value}.` };
  }
  const v = day[c.field] as number | null;
  if (v === null) return { ok: false, text: `${FIELD_LABEL[c.field]} not in the forecast.` };
  const n = Number(c.value);
  const ok = c.op === "<" ? v < n : c.op === "<=" ? v <= n : c.op === ">" ? v > n : v >= n;
  const unit = c.field === "precipProb" ? "" : "°F";
  const verb = ok ? `is ${OP_WORDS[c.op]}` : `is not ${OP_WORDS[c.op]}`;
  return { ok, text: `${FIELD_LABEL[c.field]} of ${v}${unit} ${verb} ${n}${unit}.` };
}

/** Pure: does this rule fire on this night, and why, in a sentence a volunteer can read. */
export function evaluate(day: ForecastDay, rule: Rule): RuleResult {
  const checks = rule.conditions.map((c) => check(day, c));
  const fired = rule.match === "any" ? checks.some((c) => c.ok) : checks.every((c) => c.ok);
  // Explain with the conditions that decided the outcome.
  const deciding = fired ? checks.filter((c) => c.ok) : checks;
  const reason = rule.match === "any" && !fired ? checks[0].text : deciding.map((c) => c.text).join(" ");
  return { ruleId: rule.id, fired, reason };
}

export function evaluateAll(day: ForecastDay, rules: Rule[] = RULES): RuleResult[] {
  return rules.map((r) => evaluate(day, r));
}
