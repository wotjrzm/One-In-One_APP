import type { CodingTest } from "@/lib/problems/schema";

export type TestResult = { passed: boolean; output?: string; error?: string };

/**
 * Builds a Python program: the user's code, then a runner that calls the function for each test
 * and prints a JSON array of results as the LAST line of stdout.
 */
export function buildHarness(code: string, functionName: string, tests: CodingTest[]): string {
  const testsLiteral = JSON.stringify(JSON.stringify(tests));
  const nameLiteral = JSON.stringify(functionName);
  return `${code}

import json as __json
__tests = __json.loads(${testsLiteral})
__results = []
for __t in __tests:
    try:
        __actual = globals()[${nameLiteral}](*__t["args"])
        __norm = __json.loads(__json.dumps(__actual))
        if __norm == __t["expected"]:
            __results.append({"passed": True})
        else:
            __results.append({"passed": False, "output": __json.dumps(__norm)[:200]})
    except BaseException as __e:
        __results.append({"passed": False, "error": (str(__e) or type(__e).__name__)[:200]})
print()
print(__json.dumps(__results))
`;
}

/** Parses the last non-empty stdout line as the results array. Anything else yields []. */
export function parseHarnessOutput(stdout: string): TestResult[] {
  const lines = stdout.split(/\r?\n/).filter((l) => l.trim() !== "");
  const last = lines[lines.length - 1];
  if (!last) return [];
  try {
    const v: unknown = JSON.parse(last);
    if (!Array.isArray(v)) return [];
    const out: TestResult[] = [];
    for (const r of v) {
      if (!r || typeof r !== "object" || typeof (r as { passed?: unknown }).passed !== "boolean") return [];
      const { passed, output, error } = r as { passed: boolean; output?: unknown; error?: unknown };
      out.push({
        passed,
        ...(typeof output === "string" ? { output } : {}),
        ...(typeof error === "string" ? { error } : {}),
      });
    }
    return out;
  } catch {
    return [];
  }
}
