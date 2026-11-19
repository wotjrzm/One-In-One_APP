import type { ReactNode } from "react";

export type Commit = { status: "committed"; url: string } | { status: "pending" };

export function ResultPanel({
  isCorrect,
  commit,
  explanation,
  explaining,
  explainError,
  onExplain,
  onRetry,
  children,
}: {
  /** null = an attempt exists but no fresh verdict is shown (page reopened / retrying). */
  isCorrect: boolean | null;
  commit?: Commit;
  explanation: string | null;
  explaining: boolean;
  explainError: boolean;
  onExplain: () => void;
  /** Present only when the wrong verdict is shown and editing is locked. */
  onRetry?: () => void;
  children?: ReactNode;
}) {
  const verdict = isCorrect === null ? null : isCorrect ? "정답" : "오답";
  return (
    <section
      aria-label="결과"
      className="space-y-3 rounded-2xl border bg-white p-4"
      style={{ borderColor: isCorrect === false ? "#BC4C00" : isCorrect ? "#1A7F37" : "#D0D7DE" }}
    >
      {verdict ? (
        <p className="text-lg font-bold" style={{ color: isCorrect ? "#116329" : "#BC4C00" }}>
          {verdict}
        </p>
      ) : (
        <p className="text-sm" style={{ color: "#59636E" }}>
          오늘 이 문제를 이미 풀어 봤어요.
        </p>
      )}
      {commit?.status === "committed" && (
        <a href={commit.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-medium underline" style={{ color: "#1A7F37" }}>
          커밋 보러 가기
        </a>
      )}
      {commit?.status === "pending" && (
        <p className="text-sm" style={{ color: "#59636E" }}>
          깃허브에 기록 중이에요. 잠시 후 자동으로 다시 시도해요
        </p>
      )}
      {children}
      {explanation !== null && (
        <div className="rounded-xl p-3" style={{ background: "#F6F8FA" }}>
          <h2 className="mb-1 text-sm font-bold">해설</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{explanation}</p>
        </div>
      )}
      {explainError && (
        <p role="alert" className="text-sm" style={{ color: "#BC4C00" }}>
          해설을 불러오지 못했어요. 다시 눌러 주세요.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {explanation === null && (
          <button
            type="button"
            onClick={onExplain}
            disabled={explaining}
            className="min-h-11 rounded-lg border bg-white px-4 text-sm font-medium disabled:opacity-50"
            style={{ borderColor: "#D0D7DE", color: "#1F2328" }}
          >
            해설 보기
          </button>
        )}
        {onRetry && (
          <button type="button" onClick={onRetry} className="min-h-11 rounded-lg px-4 text-sm font-medium text-white" style={{ background: "#1A7F37" }}>
            다시 풀기
          </button>
        )}
      </div>
    </section>
  );
}
