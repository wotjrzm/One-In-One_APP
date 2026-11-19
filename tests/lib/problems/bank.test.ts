import { describe, expect, it } from "vitest";
import { loadBank, getDailyProblem, toPublicProblem } from "@/lib/problems/bank";
import { parseProblem } from "@/lib/problems/schema";

const bank = loadBank("tests/fixtures/problems");

describe("getDailyProblem", () => {
  it("rotates over reviewed problems by id", () => {
    expect(getDailyProblem(bank, "network", "2026-01-05")!.id).toBe("network-001");
    expect(getDailyProblem(bank, "network", "2026-01-06")!.id).toBe("network-002");
    expect(getDailyProblem(bank, "network", "2026-01-08")!.id).toBe("network-001");
    expect(getDailyProblem(bank, "network", "2026-01-04")!.id).toBe("network-003");
  });
  it("returns null when no reviewed problems", () => {
    expect(getDailyProblem(bank, "ai", "2026-01-05")).toBeNull();
  });
});

describe("toPublicProblem", () => {
  it("strips answer and explanation from choice problems", () => {
    const pub = toPublicProblem(getDailyProblem(bank, "network", "2026-01-05")!);
    expect(pub).not.toHaveProperty("answerIndex");
    expect(pub).not.toHaveProperty("explanation");
    expect(pub).not.toHaveProperty("reviewed");
  });
  it("keeps tests but strips explanation for coding problems", () => {
    const p = getDailyProblem(bank, "coding-test", "2026-01-05")!;
    expect(p.id).toBe("coding-test-001");
    const pub = toPublicProblem(p);
    expect(pub).toHaveProperty("tests");
    expect(pub).toHaveProperty("starterCode");
    expect(pub).not.toHaveProperty("explanation");
    expect(pub).not.toHaveProperty("reviewed");
  });
});

describe("loadBank", () => {
  it("memoizes per directory", () => {
    expect(loadBank("tests/fixtures/problems")).toBe(bank);
    const other = loadBank("tests/fixtures/nonexistent");
    expect(other).not.toBe(bank);
    expect(other.network).toEqual([]);
  });
});

describe("parseProblem", () => {
  it("throws with the id on malformed input", () => {
    expect(() => parseProblem({ id: "network-009", type: "network", choices: ["a"] })).toThrow(/network-009/);
  });
  it("rejects bad answerIndex and empty coding tests", () => {
    const base = { id: "network-010", type: "network", title: "t", prompt: "p", choices: ["a", "b", "c", "d"], explanation: "e", reviewed: true };
    expect(() => parseProblem({ ...base, answerIndex: 4 })).toThrow(/network-010/);
    expect(() =>
      parseProblem({ id: "coding-test-009", type: "coding-test", title: "t", prompt: "p", explanation: "e", reviewed: true, examples: [], starterCode: "", functionName: "f", tests: [] }),
    ).toThrow(/coding-test-009/);
  });
});
