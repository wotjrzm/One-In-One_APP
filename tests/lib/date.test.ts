import { describe, expect, it } from "vitest";
import { addDays, daysBetween, toKstDate, weekStartKst } from "@/lib/date";

describe("date utils", () => {
  it("toKstDate respects the KST midnight boundary", () => {
    expect(toKstDate(new Date("2026-11-19T14:59:59Z"))).toBe("2026-11-19");
    expect(toKstDate(new Date("2026-11-19T15:00:00Z"))).toBe("2026-11-20");
  });
  it("addDays", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("daysBetween", () => {
    expect(daysBetween("2026-01-05", "2026-01-12")).toBe(7);
    expect(daysBetween("2026-01-12", "2026-01-05")).toBe(-7);
  });
  it("weekStartKst returns Monday", () => {
    expect(weekStartKst("2026-11-19")).toBe("2026-11-16");
    expect(weekStartKst("2026-11-16")).toBe("2026-11-16");
    expect(weekStartKst("2026-11-22")).toBe("2026-11-16");
  });
});
