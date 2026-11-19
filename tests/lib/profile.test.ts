import { describe, expect, it } from "vitest";
import { normalizeDisplayName } from "@/lib/profile";

describe("normalizeDisplayName", () => {
  it("trims and collapses whitespace", () => expect(normalizeDisplayName("  a   b ")).toBe("a b"));
  it("accepts exactly 20 characters, counting Hangul as one each", () => {
    expect(normalizeDisplayName("가".repeat(20))).toBe("가".repeat(20));
    expect(normalizeDisplayName("가".repeat(21))).toBeNull();
  });
  it("rejects empty, control characters and non-strings", () => {
    for (const bad of ["", "  ", "a\u0000b", "a\tb\u0007", undefined, 1]) expect(normalizeDisplayName(bad)).toBeNull();
  });
});
