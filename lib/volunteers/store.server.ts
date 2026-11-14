import fs from "node:fs";
import path from "node:path";
import type { Store } from "./store";

const FILE = path.join(process.cwd(), "data", "volunteer_store.json");

export function readStore(): Store {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")) as Store; }
  catch { return { signups: [], requests: [] }; }
}

export function writeStore(store: Store) {
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
}
