import type { ProblemType } from "@/lib/types";

export type ChoiceProblem = {
  id: string;
  type: "ai" | "network" | "claude-code";
  title: string;
  prompt: string;
  choices: [string, string, string, string];
  answerIndex: 0 | 1 | 2 | 3;
  explanation: string;
  reviewed: boolean;
};

export type CodingTest = { args: unknown[]; expected: unknown };

export type CodingProblem = {
  id: string;
  type: "coding-test";
  title: string;
  prompt: string;
  examples: { input: string; output: string }[];
  starterCode: string;
  functionName: string;
  tests: CodingTest[];
  explanation: string;
  reviewed: boolean;
};

export type Problem = ChoiceProblem | CodingProblem;

export type PublicProblem =
  | Omit<ChoiceProblem, "answerIndex" | "explanation" | "reviewed">
  | Omit<CodingProblem, "explanation" | "reviewed">;

const TYPES: readonly ProblemType[] = ["ai", "network", "claude-code", "coding-test"];

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const isStr = (v: unknown): v is string => typeof v === "string";

/** Validates raw JSON; throws an Error mentioning the problem id on any mismatch. */
export function parseProblem(raw: unknown): Problem {
  const id = isObj(raw) && isStr(raw.id) ? raw.id : "<unknown id>";
  const fail = (why: string): never => {
    throw new Error(`Invalid problem ${id}: ${why}`);
  };
  if (!isObj(raw)) return fail("not an object");
  if (!isStr(raw.id) || !/^[a-z-]+-\d{3}$/.test(raw.id)) fail("bad id");
  if (!isStr(raw.type) || !TYPES.includes(raw.type as ProblemType)) fail("bad type");
  if (!(raw.id as string).startsWith(`${raw.type}-`)) fail("id does not match type");
  for (const k of ["title", "prompt", "explanation"]) {
    if (!isStr(raw[k])) fail(`${k} must be a string`);
  }
  if (typeof raw.reviewed !== "boolean") fail("reviewed must be a boolean");

  if (raw.type === "coding-test") {
    const { examples, tests } = raw;
    if (
      !Array.isArray(examples) ||
      !examples.every((e) => isObj(e) && isStr(e.input) && isStr(e.output))
    ) {
      fail("examples invalid");
    }
    if (!isStr(raw.starterCode)) fail("starterCode must be a string");
    if (!isStr(raw.functionName) || raw.functionName === "") fail("functionName invalid");
    if (
      !Array.isArray(tests) ||
      tests.length === 0 ||
      !tests.every((t) => isObj(t) && Array.isArray(t.args) && "expected" in t)
    ) {
      fail("tests invalid");
    }
    return raw as unknown as CodingProblem;
  }

  const { choices, answerIndex } = raw;
  if (!Array.isArray(choices) || choices.length !== 4 || !choices.every(isStr)) {
    fail("choices must be 4 strings");
  }
  if (!Number.isInteger(answerIndex) || (answerIndex as number) < 0 || (answerIndex as number) > 3) {
    fail("answerIndex must be 0-3");
  }
  return raw as unknown as ChoiceProblem;
}
