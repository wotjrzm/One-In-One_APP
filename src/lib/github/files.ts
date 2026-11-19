import type { Problem } from "@/lib/problems/schema";
import type { SubmissionInput } from "@/lib/submission/validate";
import { TYPE_LABELS } from "@/lib/types";

const CHOICE_MARKERS = ["①", "②", "③", "④"] as const;

function problemMd(problem: Problem): string {
  const lines = [`# ${problem.title}`, "", `유형: ${TYPE_LABELS[problem.type]}`, "", problem.prompt, ""];
  if (problem.type === "coding-test") {
    lines.push("## 예시", "");
    for (const ex of problem.examples) {
      lines.push(`- 입력: \`${ex.input}\``, `  출력: \`${ex.output}\``);
    }
    lines.push("");
  } else {
    lines.push("## 보기", "");
    problem.choices.forEach((choice, i) => lines.push(`${CHOICE_MARKERS[i]} ${choice}`, ""));
  }
  return lines.join("\n");
}

function fenceFor(code: string): string {
  const longest = Math.max(0, ...(code.match(/`+/g) ?? []).map((m) => m.length));
  return "`".repeat(Math.max(3, longest + 1));
}

function answerMd(problem: Problem, input: SubmissionInput, isCorrect: boolean): string {
  const lines = [`# ${problem.title}`, "", `결과: ${isCorrect ? "정답" : "오답"}`, ""];
  if (input.kind === "choice" && problem.type !== "coding-test") {
    const i = input.choiceIndex;
    lines.push("## 내가 고른 보기", "", `${CHOICE_MARKERS[i]} ${problem.choices[i]}`, "");
  } else if (input.kind === "code") {
    const fence = fenceFor(input.code);
    lines.push("## 제출한 코드", "", `${fence}python`, input.code, fence, "", "## 테스트 결과", "");
    input.results.forEach((r, i) => lines.push(`- 테스트 ${i + 1}: ${r.passed ? "통과" : "실패"}`));
    lines.push("");
  }
  if (isCorrect) lines.push("## 해설", "", problem.explanation, "");
  return lines.join("\n");
}

export function buildCommit(args: {
  dateKst: string;
  problem: Problem;
  input: SubmissionInput;
  isCorrect: boolean;
}): { message: string; files: { path: string; content: string }[] } {
  const { dateKst, problem, input, isCorrect } = args;
  const result = isCorrect ? "correct" : "wrong";
  const dir = `${dateKst}/${problem.type}/${result}`;
  return {
    message: `${dateKst} ${problem.type}: ${result}`,
    files: [
      { path: `${dir}/problem.md`, content: problemMd(problem) },
      { path: `${dir}/answer.md`, content: answerMd(problem, input, isCorrect) },
    ],
  };
}

export type Commit = ReturnType<typeof buildCommit>;
