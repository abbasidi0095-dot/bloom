import { describe, expect, it } from "vitest";
import en from "@/i18n/en.json";
import fr from "@/i18n/fr.json";
import es from "@/i18n/es.json";
import ar from "@/i18n/ar.json";
import { records, validateBody } from "@/lib/records";

describe("translations", () => {
  const base = Object.keys(en).sort();
  for (const [locale, dict] of Object.entries({ fr, es, ar })) {
    it(`${locale} has the same keys as English`, () => {
      expect(Object.keys(dict).sort()).toEqual(base);
    });
  }

  it("keeps every interpolation placeholder", () => {
    for (const [key, value] of Object.entries(en)) {
      for (const [locale, dict] of Object.entries({ fr, es, ar })) {
        const placeholders = (value.match(/\{\w+\}/g) ?? []).sort();
        const translated = ((dict as Record<string, string>)[key] ?? "").match(/\{\w+\}/g) ?? [];
        expect(translated.sort(), `${locale}.${key}`).toEqual(placeholders);
      }
    }
  });
});

describe("record validation", () => {
  it("accepts a valid formula feed", () => {
    const data = validateBody(
      records.feedings,
      {
        type: "formula",
        startedAt: "2026-11-02T09:00:00.000Z",
        amountMl: 120,
        formulaBrand: "Aptamil",
      },
      "create",
    );
    expect(data.amountMl).toBe(120);
    expect(data.type).toBe("formula");
  });

  it("rejects a feed without a type", () => {
    expect(() =>
      validateBody(records.feedings, { startedAt: "2026-11-02T09:00:00.000Z" }, "create"),
    ).toThrow();
  });

  it("rejects an invalid diaper kind", () => {
    expect(() =>
      validateBody(
        records.diapers,
        { kind: "soaked", occurredAt: "2026-11-02T09:00:00.000Z" },
        "create",
      ),
    ).toThrow();
  });

  it("rejects an impossible temperature", () => {
    expect(() =>
      validateBody(
        records.temperatures,
        { celsius: 60, measuredAt: "2026-11-02T09:00:00.000Z" },
        "create",
      ),
    ).toThrow();
  });

  it("accepts a partial update", () => {
    const data = validateBody(records.diapers, { notes: "A little wet" }, "update");
    expect(data).toEqual({ notes: "A little wet" });
  });

  it("does not allow unknown columns", () => {
    expect(() =>
      validateBody(records.diapers, { kind: "wet", occurredAt: "2026-11-02T09:00:00Z", familyId: "x" }, "create"),
    ).toThrow();
  });
});
