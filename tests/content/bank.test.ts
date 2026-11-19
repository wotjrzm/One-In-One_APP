import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildHarness, parseHarnessOutput } from "@/lib/coding/harness";
import { loadBank } from "@/lib/problems/bank";
import { parseProblem } from "@/lib/problems/schema";
import { PROBLEM_TYPES } from "@/lib/types";

const DIR = "content/problems";
const SOLUTIONS = "tests/content/solutions";

// The Windows Store "python" alias exits non-zero without printing a version, so it counts as unavailable.
function findPython(): string[] | null {
  for (const cmd of [["python3"], ["python"], ["py", "-3"]]) {
    try {
      const out = execFileSync(cmd[0], [...cmd.slice(1), "--version"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (/^Python 3/.test(out)) return cmd;
    } catch {
      /* not usable */
    }
  }
  return null;
}
const python = findPython();

const bank = loadBank(DIR);

describe("content bank", () => {
  it("has 7 problems per type", () => {
    for (const t of PROBLEM_TYPES) expect(bank[t]).toHaveLength(7);
  });

  it("every file parses and its name matches the id", () => {
    for (const t of PROBLEM_TYPES) {
      const files = fs.readdirSync(path.join(DIR, t)).filter((f) => f.endsWith(".json"));
      expect(files).toHaveLength(7);
      for (const f of files) {
        const p = parseProblem(JSON.parse(fs.readFileSync(path.join(DIR, t, f), "utf8")));
        expect(f).toBe(`${p.id}.json`);
        expect(p.type).toBe(t);
        expect(p.reviewed).toBe(false);
      }
    }
  });

  it("choice problems have 4 distinct choices", () => {
    for (const t of ["ai", "network", "claude-code"] as const) {
      for (const p of bank[t]) {
        if (p.type === "coding-test") throw new Error(`${p.id} has wrong type`);
        expect(new Set(p.choices).size, p.id).toBe(4);
      }
    }
  });

  it("coding problems follow the starter-code and test conventions", () => {
    for (const p of bank["coding-test"]) {
      if (p.type !== "coding-test") throw new Error(`${p.id} has wrong type`);
      expect(p.functionName).toBe("solution");
      expect(p.starterCode).toMatch(/^def solution\([^)]*\):\n {4}# 여기에 작성하세요\n {4}pass\n$/);
      expect(p.examples.length, p.id).toBeGreaterThanOrEqual(2);
      expect(p.tests.length, p.id).toBeGreaterThanOrEqual(5);
      expect(fs.existsSync(path.join(SOLUTIONS, `${p.id}.py`)), p.id).toBe(true);
    }
  });

  it.skipIf(!python)("model solutions pass every test", () => {
    for (const p of bank["coding-test"]) {
      if (p.type !== "coding-test") continue;
      const code = fs.readFileSync(path.join(SOLUTIONS, `${p.id}.py`), "utf8");
      const r = spawnSync(python![0], [...python!.slice(1), "-c", buildHarness(code, p.functionName, p.tests)], {
        encoding: "utf8",
      });
      expect(r.status, `${p.id}: ${r.stderr}`).toBe(0);
      const results = parseHarnessOutput(r.stdout);
      expect(results, p.id).toHaveLength(p.tests.length);
      expect(results.every((x) => x.passed), `${p.id}: ${JSON.stringify(results)}`).toBe(true);
    }
  });
});
