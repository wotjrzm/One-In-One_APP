import { describe, expect, it } from "vitest";
import { buildCommit } from "@/lib/github/files";
import type { ChoiceProblem, CodingProblem } from "@/lib/problems/schema";

const networkProblem: ChoiceProblem = {
  id: "network-001",
  type: "network",
  title: "HTTP 상태 코드",
  prompt: "리소스를 찾을 수 없을 때의 상태 코드는?",
  choices: ["200", "301", "404", "500"],
  answerIndex: 2,
  explanation: "404는 Not Found 이다.",
  reviewed: true,
};

const codingProblem: CodingProblem = {
  id: "coding-test-001",
  type: "coding-test",
  title: "그대로 반환",
  prompt: "입력을 그대로 반환하세요.",
  examples: [{ input: "1", output: "1" }],
  starterCode: "def solution(a):\n  pass",
  functionName: "solution",
  tests: [{ args: [1], expected: 1 }],
  explanation: "a를 반환하면 된다.",
  reviewed: true,
};

describe("buildCommit", () => {
  it("builds a wrong choice commit without explanation or correct answer", () => {
    const c = buildCommit({
      dateKst: "2026-11-19",
      problem: networkProblem,
      input: { kind: "choice", choiceIndex: 0 },
      isCorrect: false,
    });
    expect(c.message).toBe("2026-11-19 network: wrong");
    expect(c.files.map((f) => f.path)).toEqual([
      "2026-11-19/network/wrong/problem.md",
      "2026-11-19/network/wrong/answer.md",
    ]);
    const [problemMd, answerMd] = [c.files[0].content, c.files[1].content];
    expect(problemMd).toContain("# HTTP 상태 코드");
    expect(problemMd).toContain("네트워크");
    expect(problemMd).toContain("③ 404");
    expect(answerMd).toContain("오답");
    expect(answerMd).toContain("①");
    expect(answerMd).not.toContain("## 해설");
    expect(answerMd).not.toContain("404는 Not Found");
    expect(answerMd).not.toContain("③");
  });

  it("marks the chosen option for index 2", () => {
    const c = buildCommit({
      dateKst: "2026-11-19",
      problem: networkProblem,
      input: { kind: "choice", choiceIndex: 2 },
      isCorrect: false,
    });
    expect(c.files[1].content).toContain("③");
    expect(c.files[1].content).not.toContain("## 해설");
  });

  it("includes the explanation only for a correct choice commit", () => {
    const c = buildCommit({
      dateKst: "2026-11-19",
      problem: networkProblem,
      input: { kind: "choice", choiceIndex: 2 },
      isCorrect: true,
    });
    expect(c.message).toBe("2026-11-19 network: correct");
    expect(c.files[1].path).toBe("2026-11-19/network/correct/answer.md");
    expect(c.files[1].content).toContain("정답");
    expect(c.files[1].content).toContain("## 해설");
    expect(c.files[1].content).toContain("404는 Not Found");
  });

  it("builds a correct coding commit with code block and test results", () => {
    const cc = buildCommit({
      dateKst: "2026-11-19",
      problem: codingProblem,
      input: { kind: "code", code: "def solution(a):\n  return a", passed: true, results: [{ passed: true }] },
      isCorrect: true,
    });
    expect(cc.files[0].content).toContain("코딩 테스트");
    expect(cc.files[0].content).toContain("예시");
    expect(cc.files[1].content).toContain("```python\ndef solution(a):");
    expect(cc.files[1].content).toContain("## 해설");
    expect(cc.files[1].content).toContain("통과");
  });

  it("omits explanation for a wrong coding commit and reports failures", () => {
    const cw = buildCommit({
      dateKst: "2026-11-19",
      problem: codingProblem,
      input: { kind: "code", code: "def solution(a):\n  return 0", passed: false, results: [{ passed: false }] },
      isCorrect: false,
    });
    expect(cw.files[1].content).toContain("오답");
    expect(cw.files[1].content).toContain("실패");
    expect(cw.files[1].content).not.toContain("## 해설");
    expect(cw.files[1].content).not.toContain("a를 반환하면");
  });
});
