import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { buildHarness, parseHarnessOutput } from "@/lib/coding/harness";

const tests = [
  { args: [1, 2], expected: 3 },
  { args: [[1], [2]], expected: [1, 2] },
  { args: [1, 1], expected: 3 },
];
const code = "def solution(a, b):\n    return a + b";

function findPython(): string[] | null {
  for (const cmd of [["python"], ["python3"], ["py", "-3"]]) {
    try {
      const out = execFileSync(cmd[0], [...cmd.slice(1), "--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      if (/^Python 3/.test(out)) return cmd;
    } catch {
      /* not usable */
    }
  }
  return null;
}
const python = findPython();

describe("buildHarness", () => {
  it("embeds user code first and prints JSON results", () => {
    const src = buildHarness(code, "solution", tests);
    expect(src).toContain("def solution(a, b):");
    expect(src.indexOf("def solution(a, b):")).toBeLessThan(src.indexOf("json.dumps"));
  });

  it.skipIf(!python)("runs under real Python and reports per-test results", () => {
    const src = buildHarness(code, "solution", tests);
    const r = spawnSync(python![0], [...python!.slice(1), "-c", src], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(parseHarnessOutput(r.stdout)).toEqual([
      { passed: true },
      { passed: true },
      { passed: false, output: "2" },
    ]);
  });

  it.skipIf(!python)("captures exceptions per test and ignores user prints", () => {
    const src = buildHarness("def solution(a, b):\n    print('noise')\n    raise ValueError('boom')", "solution", [tests[0]]);
    const r = spawnSync(python![0], [...python!.slice(1), "-c", src], { encoding: "utf8" });
    expect(parseHarnessOutput(r.stdout)).toEqual([{ passed: false, error: "boom" }]);
  });
});

describe("missing function", () => {
  it.skipIf(!python)("emits one run-level error instead of KeyError", () => {
    const src = buildHarness("x = 1", "solution", tests);
    const r = spawnSync(python![0], [...python!.slice(1), "-c", src], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(parseHarnessOutput(r.stdout)).toEqual([{ passed: false, error: "함수 solution를 정의해 주세요" }]);
  });
});

describe("parseHarnessOutput", () => {
  it("parses the last non-empty line", () => {
    expect(parseHarnessOutput('noise\n[{"passed":true},{"passed":true},{"passed":false,"output":"2"}]\n')).toEqual([
      { passed: true },
      { passed: true },
      { passed: false, output: "2" },
    ]);
  });
  it("returns [] for empty or garbage", () => {
    expect(parseHarnessOutput("")).toEqual([]);
    expect(parseHarnessOutput("hello")).toEqual([]);
    expect(parseHarnessOutput('{"a":1}')).toEqual([]);
  });
});
