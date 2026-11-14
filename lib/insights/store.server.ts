import fs from "node:fs";
import path from "node:path";
import type { IntakeEvent } from "./index";

// Aggregate intake events recorded when a volunteer reaches the results step.
// One line per routing: date, confirmed need tags, top site id. Nothing about the person.
const FILE = path.join(process.cwd(), "data", "intake_events.json");

export function readEvents(): IntakeEvent[] {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")) as IntakeEvent[]; }
  catch { return []; }
}
export function writeEvents(events: IntakeEvent[]) {
  fs.writeFileSync(FILE, JSON.stringify(events, null, 2));
}
