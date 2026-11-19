import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
    expect(loadBank("tests/fixtures/problems/../problems")).toBe(bank);
  });
  it("throws a clear error when the root dir is missing", () => {
    expect(() => loadBank("tests/fixtures/nonexistent")).toThrow(/problem bank.*nonexistent/i);
  });
  it("treats a missing single type dir as empty", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bank-"));
    expect(loadBank(dir).ai).toEqual([]);
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

describe("loadBank hardening", () => {
  function tmpBank(type: string, file: string, content: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bank-"));
    fs.mkdirSync(path.join(dir, type));
    fs.writeFileSync(path.join(dir, type, file), content);
    return dir;
  }
  const net = (id: string, extra: object = {}) =>
    JSON.stringify({ id, type: "network", title: "t", prompt: "p", choices: ["a", "b", "c", "d"], answerIndex: 0, explanation: "e", reviewed: true, ...extra });

  it("throws with the path when JSON is malformed", () => {
    const dir = tmpBank("network", "network-001.json", "{ not json");
    expect(() => loadBank(dir)).toThrow(/network-001\.json/);
  });
  it("throws when filename does not match id", () => {
    const dir = tmpBank("network", "network-002.json", net("network-001"));
    expect(() => loadBank(dir)).toThrow(/network-002\.json/);
  });
  it("throws when type does not match its directory", () => {
    const dir = tmpBank("ai", "network-001.json", net("network-001"));
    expect(() => loadBank(dir)).toThrow(/ai/);
  });
  it("toPublicProblem never leaks unknown keys", () => {
    const dir = tmpBank("network", "network-001.json", net("network-001", { answer: "A", secret: 1 }));
    const pub = toPublicProblem(loadBank(dir).network[0]);
    expect(pub).not.toHaveProperty("answer");
    expect(pub).not.toHaveProperty("secret");
    expect(Object.keys(pub).sort()).toEqual(["choices", "id", "prompt", "title", "type"]);
  });
});
