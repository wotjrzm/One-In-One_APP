"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChoiceQuestion, type ChoiceProblemPublic } from "@/components/ChoiceQuestion";
import { CodingQuestion, type CodingProblemPublic } from "@/components/CodingQuestion";
import { ResultPanel, type Commit } from "@/components/ResultPanel";
import { TypeTabs, type TabItem } from "@/components/TypeTabs";
import { buildHarness, parseHarnessOutput, type TestResult } from "@/lib/coding/harness";
import { ensureReady, runPython } from "@/lib/coding/runner";
import type { PublicProblem } from "@/lib/problems/schema";
import { normalizePython } from "@/lib/submission/validate";
import { PROBLEM_TYPES, type ProblemType } from "@/lib/types";

type Status = "correct" | "wrong" | "none";
type TodayItem = { type: ProblemType; label: string; problem: PublicProblem | null; status: Status };
type Today = { date: string; items: TodayItem[]; repo: { status: "none" | "connected" | "disconnected" } };
type Verdict = { isCorrect: boolean; commit?: Commit };
type Notice = { text: string; link?: { href: string; label: string } };

const card = "rounded-2xl border bg-white p-4";
const cardStyle = { borderColor: "#D0D7DE" };

function Skeleton() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">불러오는 중</span>
      {[44, 80, 220].map((h) => (
        <div key={h} className="animate-pulse rounded-2xl" style={{ height: h, background: "#EBEEF1" }} />
      ))}
    </div>
  );
}

function runErrorText(error: string): string {
  if (error === "timeout") return "실행 시간이 5초를 넘었어요. 무한 반복이 없는지 확인해 주세요.";
  if (error === "load_failed") return "Python을 불러오지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.";
  return `실행 중 오류가 발생했어요: ${error}`;
}

export default function SolvePage() {
  const { type } = useParams<{ type: string }>();
  if (!PROBLEM_TYPES.includes(type as ProblemType)) {
    return (
      <div className={`${card} text-center`} style={cardStyle}>
        <p className="mb-3 text-sm" style={{ color: "#59636E" }}>
          존재하지 않는 문제 유형이에요.
        </p>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium text-white" style={{ background: "#1A7F37" }}>
          홈으로
        </Link>
      </div>
    );
  }
  return <Solve key={type} type={type as ProblemType} />;
}

function Solve({ type }: { type: ProblemType }) {
  const router = useRouter();
  const [today, setToday] = useState<Today | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [selected, setSelected] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [explanation, setExplanation] = useState<string | null>(null);
  const [answerIndex, setAnswerIndex] = useState<number | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState(false);

  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [loadingPython, setLoadingPython] = useState(false);

  const load = useCallback(
    async () => {
      setLoadError(false);
      try {
        const res = await fetch("/api/today");
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as Today;
        if (json.repo.status === "none") {
          router.replace("/onboarding");
          return;
        }
        const item = json.items.find((i) => i.type === type);
        setToday(json);
        setSelected(null);
        setTestResults(null);
        setRunError(null);
        setExplanation(null);
        setAnswerIndex(null);
        setExplainError(false);
        setCode(item?.problem?.type === "coding-test" ? item.problem.starterCode : "");
        setAttempted(item?.status === "correct" || item?.status === "wrong");
        setVerdict(item?.status === "correct" ? { isCorrect: true } : null);
      } catch {
        setLoadError(true);
      }
    },
    [router, type],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError) {
    return (
      <div className={`${card} text-center`} style={cardStyle}>
        <p className="mb-3 text-sm" style={{ color: "#59636E" }}>
          오늘의 문제를 불러오지 못했어요.
        </p>
        <button type="button" onClick={() => void load()} className="min-h-11 rounded-lg px-4 text-sm font-medium text-white" style={{ background: "#1A7F37" }}>
          다시 시도
        </button>
      </div>
    );
  }
  if (!today) return <Skeleton />;

  const item = today.items.find((i) => i.type === type);
  const tabs: TabItem[] = today.items.map((i) => ({ type: i.type, label: i.label, status: i.status }));
  const problem = item?.problem ?? null;

  if (!problem) {
    return (
      <div className="space-y-4">
        <TypeTabs items={tabs} current={type} />
        <div className={`${card} text-center`} style={cardStyle}>
          <p className="mb-3 text-sm" style={{ color: "#59636E" }}>
            준비 중이에요. 곧 새 문제가 올라와요.
          </p>
          <Link href="/" className="inline-flex min-h-11 items-center text-sm font-medium underline" style={{ color: "#1A7F37" }}>
            홈으로
          </Link>
        </div>
      </div>
    );
  }

  const solved = verdict?.isCorrect === true;
  const locked = verdict !== null;
  const isCoding = problem.type === "coding-test";
  const emptyInput = isCoding ? code.trim() === "" : selected === null;

  async function runTests(p: CodingProblemPublic): Promise<{ results: TestResult[]; error: string | null }> {
    setLoadingPython(true);
    try {
      await ensureReady();
    } catch {
      setLoadingPython(false);
      return { results: [], error: "load_failed" };
    }
    setLoadingPython(false);
    const out = await runPython(buildHarness(code, p.functionName, p.tests));
    if ("error" in out) return { results: [], error: out.error };
    const results = parseHarnessOutput(out.stdout);
    if (results.length !== p.tests.length) return { results: [], error: "결과를 읽지 못했어요" };
    return { results, error: null };
  }

  async function onRun() {
    if (!problem || problem.type !== "coding-test") return;
    setNotice(null);
    setRunning(true);
    const { results, error } = await runTests(problem);
    setTestResults(error ? null : results);
    setRunError(error ? runErrorText(error) : null);
    setRunning(false);
  }

  async function onSubmit() {
    if (!problem || submitting) return;
    setNotice(null);
    let input: unknown;
    if (problem.type === "coding-test") {
      const n = normalizePython(code);
      if (n === "" || n === normalizePython(problem.starterCode)) {
        setNotice({ text: "코드를 작성해 주세요" });
        return;
      }
      setSubmitting(true);
      setRunning(true);
      const { results, error } = await runTests(problem);
      setRunning(false);
      setTestResults(error ? null : results);
      setRunError(error ? runErrorText(error) : null);
      input = {
        kind: "code",
        code,
        passed: !error && results.length > 0 && results.every((r) => r.passed),
        results: error ? [{ passed: false, error }] : results,
      };
    } else {
      if (selected === null) return;
      setSubmitting(true);
      input = { kind: "choice", choiceIndex: selected };
    }

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, problemId: problem.id, input }),
      });
      const body = (await res.json().catch(() => ({}))) as { isCorrect?: boolean; commit?: Commit; error?: string };
      if (res.ok && typeof body.isCorrect === "boolean") {
        setVerdict({ isCorrect: body.isCorrect, commit: body.commit });
        setAttempted(true);
        setToday((t) =>
          t ? { ...t, items: t.items.map((i) => (i.type === type ? { ...i, status: body.isCorrect ? "correct" : i.status === "correct" ? "correct" : "wrong" } : i)) } : t,
        );
      } else if (res.status === 409 && body.error === "date_changed") {
        setNotice({ text: "날짜가 바뀌었어요. 오늘의 문제를 불러올게요" });
        await load();
      } else if (res.status === 409 && body.error === "already_solved") {
        setAttempted(true);
        setVerdict({ isCorrect: true });
      } else if (res.status === 412) {
        setNotice({ text: "저장소 연결이 필요해요.", link: { href: "/onboarding", label: "저장소 다시 연결하기" } });
      } else if (res.status === 400 && body.error === "empty") {
        setNotice({ text: "코드를 작성해 주세요" });
      } else {
        setNotice({ text: "제출하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    } catch {
      setNotice({ text: "제출하지 못했어요. 잠시 후 다시 시도해 주세요." });
    } finally {
      setSubmitting(false);
    }
  }

  async function onExplain() {
    setExplaining(true);
    setExplainError(false);
    try {
      const res = await fetch(`/api/explanation?type=${type}`);
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { explanation: string; answerIndex?: number };
      setExplanation(body.explanation);
      setAnswerIndex(typeof body.answerIndex === "number" ? body.answerIndex : null);
    } catch {
      setExplainError(true);
    } finally {
      setExplaining(false);
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <TypeTabs items={tabs} current={type} />

      {problem.type === "coding-test" ? (
        <CodingQuestion
          problem={problem}
          code={code}
          onChange={setCode}
          disabled={locked || submitting}
          onRun={() => void onRun()}
          running={running}
          loadingPython={loadingPython}
          results={testResults}
          runError={runError}
        />
      ) : (
        <ChoiceQuestion
          problem={problem as ChoiceProblemPublic}
          selected={selected}
          onSelect={setSelected}
          disabled={locked || submitting}
          correctIndex={answerIndex}
        />
      )}

      {notice && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm font-medium" style={{ background: "#FFF1E5", borderColor: "#D0D7DE", color: "#953800" }}>
          <span>{notice.text}</span>
          {notice.link && (
            <Link href={notice.link.href} className="inline-flex min-h-11 items-center rounded-lg bg-white px-3" style={{ border: "1px solid #D0D7DE", color: "#1F2328" }}>
              {notice.link.label}
            </Link>
          )}
        </div>
      )}

      {(attempted || verdict) && (
        <ResultPanel
          isCorrect={verdict ? verdict.isCorrect : null}
          commit={verdict?.commit}
          explanation={explanation}
          explaining={explaining}
          explainError={explainError}
          onExplain={() => void onExplain()}
          onRetry={verdict && !solved ? () => setVerdict(null) : undefined}
        />
      )}

      {!locked && (
        <div
          className="fixed inset-x-0 z-10 border-t bg-white px-4 py-3"
          style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))", borderColor: "#D0D7DE" }}
        >
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={emptyInput || submitting}
            className="mx-auto block min-h-12 w-full max-w-[448px] rounded-xl text-base font-bold text-white disabled:opacity-40"
            style={{ background: "#1A7F37" }}
          >
            제출하고 커밋하기
          </button>
        </div>
      )}
    </div>
  );
}
