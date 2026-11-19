"use client";

import { python } from "@codemirror/lang-python";
import CodeMirror from "@uiw/react-codemirror";
import type { PublicProblem } from "@/lib/problems/schema";
import type { TestResult } from "@/lib/coding/harness";

export type CodingProblemPublic = Extract<PublicProblem, { type: "coding-test" }>;

export function CodingQuestion({
  problem,
  code,
  onChange,
  disabled,
  onRun,
  running,
  loadingPython,
  results,
  runError,
}: {
  problem: CodingProblemPublic;
  code: string;
  onChange: (c: string) => void;
  disabled: boolean;
  onRun: () => void;
  running: boolean;
  loadingPython: boolean;
  results: TestResult[] | null;
  runError: string | null;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">{problem.title}</h1>
        <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">{problem.prompt}</p>
      </div>
      {problem.examples.length > 0 && (
        <ul className="space-y-2">
          {problem.examples.map((ex, i) => (
            <li key={i} className="rounded-xl p-3 font-mono text-sm" style={{ background: "#EBEEF1" }}>
              <div>입력: {ex.input}</div>
              <div>출력: {ex.output}</div>
            </li>
          ))}
        </ul>
      )}
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: "#D0D7DE" }} aria-label="코드 편집기">
        <CodeMirror
          value={code}
          onChange={onChange}
          extensions={[python()]}
          editable={!disabled}
          minHeight="220px"
          basicSetup={{ lineNumbers: true, foldGutter: false }}
          style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 14 }}
        />
      </div>
      <button
        type="button"
        onClick={onRun}
        disabled={disabled || running || code.trim() === ""}
        className="min-h-11 rounded-lg border bg-white px-4 text-sm font-medium disabled:opacity-50"
        style={{ borderColor: "#D0D7DE", color: "#1F2328" }}
      >
        테스트 실행
      </button>
      {loadingPython && (
        <p role="status" className="text-sm" style={{ color: "#59636E" }}>
          Python 준비 중…
        </p>
      )}
      {runError && (
        <p role="alert" className="text-sm" style={{ color: "#BC4C00" }}>
          {runError}
        </p>
      )}
      {results && results.length > 0 && (
        <ul className="space-y-1" aria-label="테스트 결과">
          {results.map((r, i) => (
            <li key={i} className="text-sm" style={{ color: r.passed ? "#116329" : "#BC4C00" }}>
              테스트 {i + 1}: {r.passed ? "통과" : "실패"}
              {!r.passed && r.error ? ` (오류: ${r.error})` : ""}
              {!r.passed && !r.error && r.output !== undefined ? ` (출력: ${r.output})` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
