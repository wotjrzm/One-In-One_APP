import type { ChoiceProblem } from "@/lib/problems/schema";

export function gradeChoice(problem: ChoiceProblem, choiceIndex: number): boolean {
  return choiceIndex === problem.answerIndex;
}
