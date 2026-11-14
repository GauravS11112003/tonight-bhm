import { describe, expect, it, vi } from "vitest";

describe("weather fallback", () => {
  it("serves the saved snapshot with a 'cached' source when NWS is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { getForecast } = await import("@/lib/weather/nws");
    const { days, source } = await getForecast();
    expect(source.kind).toBe("cached");
    expect(days.length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });
});
