import { describe, expect, it } from "vitest";
import { ageFromDob, dayKey, durationLabel, startOfDay, zonedToUtc } from "@/lib/format";
import { percentile, bandsFor, valueAtZ, zBands } from "@/lib/who";

describe("age", () => {
  it("computes months and days from a birth date", () => {
    const age = ageFromDob("2026-06-15", new Date("2026-11-02T12:00:00Z"), "UTC");
    expect(age.months).toBe(4);
    expect(age.days).toBe(18);
    expect(age.weeks).toBeGreaterThan(10);
  });

  it("never returns negative age", () => {
    const age = ageFromDob("2026-12-01", new Date("2026-11-02T12:00:00Z"), "UTC");
    expect(age.months).toBe(0);
    expect(age.days).toBeGreaterThanOrEqual(0);
  });

  it("handles dates crossing a month boundary", () => {
    const age = ageFromDob("2026-01-31", new Date("2026-03-01T12:00:00Z"), "UTC");
    expect(age.months).toBe(1);
  });
});

describe("timezone helpers", () => {
  it("keys a day in the requested timezone", () => {
    expect(dayKey("2026-11-02T23:30:00Z", "Europe/Paris")).toBe("2026-11-03");
    expect(dayKey("2026-11-02T23:30:00Z", "UTC")).toBe("2026-11-02");
  });

  it("converts wall-clock time to UTC", () => {
    const utc = zonedToUtc("2026-11-02", "09:00", "Europe/Paris");
    expect(utc.toISOString()).toBe("2026-11-02T08:00:00.000Z");
  });

  it("starts a day at local midnight", () => {
    expect(startOfDay("2026-11-02", "Europe/Paris").toISOString()).toBe("2026-11-01T23:00:00.000Z");
  });
});

describe("duration", () => {
  it("formats hours and minutes", () => {
    expect(durationLabel(0)).toBe("0s");
    expect(durationLabel(90)).toBe("1m");
    expect(durationLabel(3660)).toBe("1h 01m");
  });
});

describe("WHO growth standards", () => {
  it("places the median at the 50th percentile", () => {
    const male = valueAtZ("wfa", "male", 0, 0);
    expect(male).toBeCloseTo(3.3464, 3);
    expect(percentile("wfa", "male", 0, male)).toBeCloseTo(50, 0);
  });

  it("produces ordered percentile bands", () => {
    const bands = bandsFor("lfa", "female", 365, 30);
    expect(bands.length).toBeGreaterThan(10);
    const first = bands[0];
    expect(first.p3).toBeLessThan(first.p15);
    expect(first.p15).toBeLessThan(first.p50);
    expect(first.p50).toBeLessThan(first.p97);
    expect(zBands.p50).toBe(0);
  });

  it("increases median weight over the first year", () => {
    expect(valueAtZ("wfa", "female", 365, 0)).toBeGreaterThan(valueAtZ("wfa", "female", 0, 0));
  });
});
