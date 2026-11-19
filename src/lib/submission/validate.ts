import type { Problem } from "@/lib/problems/schema";

export type SubmissionInput =
  | { kind: "choice"; choiceIndex: number }
  | {
      kind: "code";
      code: string;
      passed: boolean;
      results: { passed: boolean; output?: string; error?: string }[];
    };

/** Removes `#` comments through end of line and all whitespace. Used only for emptiness comparison. */
export function normalizePython(code: string): string {
  return code.replace(/#.*$/gm, "").replace(/\s/g, "");
}

/**
 * True when the submission carries no real answer: no choice selected, a choice index
 * outside 0-3, a choice submitted for a coding problem (or code for a choice problem),
 * or code that is blank, comment-only, or identical to the starter code.
 */
export function isEmptySubmission(input: SubmissionInput, problem: Problem): boolean {
  if (problem.type === "coding-test") {
    if (input.kind !== "code") return true;
    const normalized = normalizePython(input.code);
    return normalized === "" || normalized === normalizePython(problem.starterCode);
  }

  if (input.kind !== "choice") return true;
  const { choiceIndex } = input;
  return !Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex > 3;
}
