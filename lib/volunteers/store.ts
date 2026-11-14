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
export type Alert = { message: string; at: string };
export type Store = { signups: Signup[]; requests: HelpRequest[]; alert?: Alert | null };

const name = z.string().trim().min(1).max(24);
const deviceId = z.string().min(6).max(64);
export const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("signup"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), name, deviceId }),
  z.object({ action: z.literal("cancel"), date: z.string(), deviceId }),
  z.object({ action: z.literal("request"), type: z.enum(REQUEST_TYPES), note: z.string().trim().max(400), urgent: z.boolean(), name, deviceId }),
  z.object({ action: z.literal("broadcast"), message: z.string().trim().min(1).max(200) }),
  z.object({ action: z.literal("clear") }),
  z.object({ action: z.literal("resolve"), id: z.string(), reply: z.string().trim().max(400) }),
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
    case "resolve":
      return { ...store, requests: store.requests.map((r) => (r.id === a.id ? { ...r, status: "resolved", reply: a.reply } : r)) };
  }
}
