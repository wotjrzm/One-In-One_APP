import { describe, expect, it } from "vitest";
import { isEmptySubmission } from "@/lib/submission/validate";
import { gradeChoice } from "@/lib/submission/grade";
import type { ChoiceProblem, CodingProblem } from "@/lib/problems/schema";

const choice: ChoiceProblem = {
  id: "network-001",
  type: "network",
  title: "t",
  prompt: "p",
  choices: ["a", "b", "c", "d"],
  answerIndex: 1,
  explanation: "e",
  reviewed: true,
};

const coding: CodingProblem = {
  id: "coding-test-001",
  type: "coding-test",
  title: "t",
  prompt: "p",
  examples: [],
  starterCode: "",
  functionName: "solution",
  tests: [{ args: [[1], 1], expected: [0] }],
  explanation: "e",
  reviewed: true,
};

describe("submission validation and grading", () => {
  it("detects empty code submissions", () => {
    const starter = 'def solution(nums, target):\n    # 여기에 작성\n    pass\n';
    expect(isEmptySubmission({kind:'code',code:'',passed:false,results:[]}, coding)).toBe(true);
    expect(isEmptySubmission({kind:'code',code:'  \n# 메모\n',passed:false,results:[]}, coding)).toBe(true);
    expect(isEmptySubmission({kind:'code',code:'def solution(nums,target):\n  pass',passed:false,results:[]}, {...coding, starterCode: starter})).toBe(true);
    expect(isEmptySubmission({kind:'code',code:'def solution(nums,target):\n  return []',passed:false,results:[]}, {...coding, starterCode: starter})).toBe(false);
  });

  it("detects empty choice submissions", () => {
    expect(isEmptySubmission({kind:'choice',choiceIndex:-1}, choice)).toBe(true);
    expect(isEmptySubmission({kind:'choice',choiceIndex:4}, choice)).toBe(true);
    expect(isEmptySubmission({kind:'choice',choiceIndex:1.5}, choice)).toBe(true);
    expect(isEmptySubmission({kind:'choice',choiceIndex:2}, choice)).toBe(false);
    expect(isEmptySubmission({kind:'choice',choiceIndex:2}, coding)).toBe(true); // 유형과 형식 불일치
  });

  it("grades choice answers", () => {
    expect(gradeChoice({...choice, answerIndex: 1}, 1)).toBe(true);
    expect(gradeChoice({...choice, answerIndex: 1}, 2)).toBe(false);
  });
});
