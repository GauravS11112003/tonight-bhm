import { z } from "zod";

// Volunteer coordination data. A JSON file is enough for a prototype:
// one shelter, a few dozen volunteers, and anyone can open the file and read it.
// Volunteers give a first name or initials only. Guests are never recorded here.
// This file is shared with the browser (types, labels, the pure reducer).
// Reading and writing the file lives in store.server.ts.

export const REQUEST_TYPES = ["supplies", "more_hands", "question", "facility"] as const;
export const REQUEST_LABEL: Record<(typeof REQUEST_TYPES)[number], string> = {
  supplies: "Supplies running low",
  more_hands: "Need more hands",
  question: "Question for staff",
  facility: "Building issue",
};

export type Signup = { id: string; date: string; name: string; deviceId: string; createdAt: string };
export type HelpRequest = {
  id: string; type: (typeof REQUEST_TYPES)[number]; note: string; urgent: boolean;
  name: string; deviceId: string; status: "open" | "resolved"; reply: string; createdAt: string;
};
// An outreach report is about an AREA, never a person: a head count and needs,
// with the location rounded to roughly three blocks. No names, no photos.
export const REPORT_NEEDS = ["blankets", "food", "medical", "transport"] as const;
export type AreaReport = { id: string; lat: number; lng: number; count: number; needs: (typeof REPORT_NEEDS)[number][]; note: string; at: string; sample?: boolean };
export const GRID = 0.003; // degrees, about 300 m
export const snap = (v: number) => Math.round(v / GRID) * GRID;
export const REPORT_TTL_MS = 24 * 60 * 60 * 1000;
// SAMPLE reports for the demo, at public landmarks. Always labeled as sample in the UI.
export const SAMPLE_REPORTS: Omit<AreaReport, "id" | "at">[] = [
  { lat: 33.5207766, lng: -86.8099219, count: 6, needs: ["blankets", "food"], note: "Sample: Linn Park", sample: true },
  { lat: 33.5096842, lng: -86.8098908, count: 3, needs: ["blankets"], note: "Sample: Railroad Park", sample: true },
  { lat: 33.5163287, lng: -86.8134594, count: 4, needs: ["food", "medical"], note: "Sample: Kelly Ingram Park", sample: true },
  { lat: 33.5005419, lng: -86.7963992, count: 2, needs: ["transport"], note: "Sample: Five Points South", sample: true },
  { lat: 33.5126182, lng: -86.8072537, count: 5, needs: ["blankets", "transport"], note: "Sample: near the Intermodal station", sample: true },
];

export type Alert = { message: string; at: string };
// Hub state. An ask's status and staff note are keyed by the ask's id (see lib/asks);
// a sent alert is keyed by the alert's id (see lib/notify). Quantities are never stored:
// they are recomputed from the forecast every time.
export type AskState = { status: "open" | "pledged" | "fulfilled"; note: string; at: string };
export type Store = { signups: Signup[]; requests: HelpRequest[]; alert?: Alert | null; reports?: AreaReport[]; asks?: Record<string, AskState>; sent?: Record<string, string> };

const name = z.string().trim().min(1).max(24);
const deviceId = z.string().min(6).max(64);
export const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("signup"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), name, deviceId }),
  z.object({ action: z.literal("cancel"), date: z.string(), deviceId }),
  z.object({ action: z.literal("request"), type: z.enum(REQUEST_TYPES), note: z.string().trim().max(400), urgent: z.boolean(), name, deviceId }),
  z.object({ action: z.literal("broadcast"), message: z.string().trim().min(1).max(200) }),
  z.object({ action: z.literal("clear") }),
  z.object({ action: z.literal("report"), lat: z.number().min(33.3).max(33.7), lng: z.number().min(-87.1).max(-86.5), count: z.number().int().min(1).max(50), needs: z.array(z.enum(REPORT_NEEDS)).max(4), note: z.string().trim().max(200) }),
  z.object({ action: z.literal("sampleReports") }),
  z.object({ action: z.literal("clearReports") }),
  z.object({ action: z.literal("resolve"), id: z.string(), reply: z.string().trim().max(400) }),
  z.object({ action: z.literal("askStatus"), id: z.string().max(120), status: z.enum(["open", "pledged", "fulfilled"]) }),
  z.object({ action: z.literal("askNote"), id: z.string().max(120), note: z.string().trim().max(200) }),
  // Marks a queued alert as sent. A volunteer alert for tonight may also go to every open phone.
  z.object({ action: z.literal("sendAlert"), id: z.string().max(120), broadcast: z.string().trim().min(1).max(200).optional() }),
  z.object({ action: z.literal("resetHub") }),
]);
export type Action = z.infer<typeof Action>;

const newId = () => Math.random().toString(36).slice(2, 10);

/** Pure: apply one action to the store. Kept separate from the file so it can be tested. */
export function apply(store: Store, a: Action, now = new Date().toISOString()): Store {
  switch (a.action) {
    case "signup":
      // One signup per device per night.
      if (store.signups.some((s) => s.date === a.date && s.deviceId === a.deviceId)) return store;
      return { ...store, signups: [...store.signups, { id: newId(), date: a.date, name: a.name, deviceId: a.deviceId, createdAt: now }] };
    case "cancel":
      return { ...store, signups: store.signups.filter((s) => !(s.date === a.date && s.deviceId === a.deviceId)) };
    case "request":
      return { ...store, requests: [{ id: newId(), type: a.type, note: a.note, urgent: a.urgent, name: a.name, deviceId: a.deviceId, status: "open", reply: "", createdAt: now }, ...store.requests] };
    case "broadcast":
      return { ...store, alert: { message: a.message, at: now } };
    case "clear":
      return { ...store, alert: null };
    case "report":
      // Round the location before it is ever stored.
      return { ...store, reports: [{ id: newId(), lat: snap(a.lat), lng: snap(a.lng), count: a.count, needs: a.needs, note: a.note, at: now }, ...(store.reports ?? [])] };
    case "sampleReports":
      return { ...store, reports: [...(store.reports ?? []).filter((r) => !r.sample), ...SAMPLE_REPORTS.map((r) => ({ ...r, id: newId(), at: now }))] };
    case "clearReports":
      return { ...store, reports: [] };
    case "askStatus": {
      const prev = store.asks?.[a.id];
      return { ...store, asks: { ...store.asks, [a.id]: { status: a.status, note: prev?.note ?? "", at: now } } };
    }
    case "askNote": {
      const prev = store.asks?.[a.id];
      return { ...store, asks: { ...store.asks, [a.id]: { status: prev?.status ?? "open", note: a.note, at: prev?.at ?? now } } };
    }
    case "sendAlert":
      if (store.sent?.[a.id]) return store; // an alert is sent once
      return { ...store, sent: { ...store.sent, [a.id]: now }, ...(a.broadcast ? { alert: { message: a.broadcast, at: now } } : {}) };
    case "resetHub":
      return { ...store, asks: {}, sent: {}, alert: null };
    case "resolve":
      return { ...store, requests: store.requests.map((r) => (r.id === a.id ? { ...r, status: "resolved", reply: a.reply } : r)) };
  }
}
