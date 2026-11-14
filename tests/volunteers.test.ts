import { describe, expect, it } from "vitest";
import { apply, type Store } from "@/lib/volunteers/store";

const empty: Store = { signups: [], requests: [] };

describe("volunteer store", () => {
  it("allows one signup per device per night, and cancelling removes it", () => {
    const a = { action: "signup", date: "2026-11-14", name: "Sam", deviceId: "device-1" } as const;
    const once = apply(empty, a);
    expect(apply(once, a).signups).toHaveLength(1);
    expect(apply(once, { action: "cancel", date: "2026-11-14", deviceId: "device-1" }).signups).toHaveLength(0);
  });
  it("a request starts open and staff can resolve it with a reply", () => {
    const s = apply(empty, { action: "request", type: "supplies", note: "Low on blankets", urgent: true, name: "Sam", deviceId: "device-1" });
    expect(s.requests[0].status).toBe("open");
    const done = apply(s, { action: "resolve", id: s.requests[0].id, reply: "On the way" });
    expect(done.requests[0]).toMatchObject({ status: "resolved", reply: "On the way" });
  });
});

describe("area reports", () => {
  it("rounds the location to the grid before storing, and keeps no person-level fields", () => {
    const s = apply(empty, { action: "report", lat: 33.51234, lng: -86.80456, count: 3, needs: ["blankets"], note: "" });
    const r = s.reports![0];
    expect(r.lat).toBeCloseTo(33.513, 3);
    expect(r.lng).toBeCloseTo(-86.805, 3);
    expect(Object.keys(r).sort()).toEqual(["at", "count", "id", "lat", "lng", "needs", "note"]);
  });
});
