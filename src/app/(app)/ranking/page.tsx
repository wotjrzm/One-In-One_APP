"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { RankingList, type RankMetric, type RankPeriod } from "@/components/RankingList";
import type { RankRow } from "@/lib/stats/ranking";

type Board = { rows: RankRow[]; me: RankRow | null };
type Data = { boards: Record<RankMetric, Board>; hidden: boolean };

const PERIODS: { value: RankPeriod; label: string }[] = [
  { value: "week", label: "이번 주" },
  { value: "all", label: "전체" },
];
const BOARDS: { metric: RankMetric; title: string; hint: string }[] = [
  { metric: "consistency", title: "Days", hint: "연속 학습일" },
  { metric: "problems", title: "Problems", hint: "도전한 문제 수" },
  { metric: "commits", title: "Commits", hint: "커밋 수" },
  { metric: "accuracy", title: "Accuracy", hint: "정답률" },
];

function Skeleton() {
  return (
    <div role="status" className="space-y-2">
      <span className="sr-only">불러오는 중</span>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl" style={{ background: "#EBEEF1" }} />
      ))}
    </div>
  );
}

function PeriodTabs({ value, onChange }: { value: RankPeriod; onChange: (v: RankPeriod) => void }) {
  return (
    <div role="tablist" aria-label="기간" className="flex gap-2">
      {PERIODS.map((item) => {
        const on = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(item.value)}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm"
            style={{
              borderColor: on ? "#1F2328" : "#D0D7DE",
              background: on ? "#1F2328" : "#fff",
              color: on ? "#fff" : "#59636E",
              fontWeight: on ? 700 : 500,
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function Ranking() {
  const router = useRouter();
  const sp = useSearchParams();
  const period: RankPeriod = sp.get("period") === "all" ? "all" : "week";

  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setData(null);
    setError(false);
    (async () => {
      try {
        const res = await fetch(`/api/ranking?period=${period}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as Data;
        if (!ctrl.signal.aborted) setData(json);
      } catch {
        if (!ctrl.signal.aborted) setError(true);
      }
    })();
    return () => ctrl.abort();
  }, [period, attempt]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold" style={{ color: "#1F2328" }}>
        랭킹
      </h1>
      <PeriodTabs value={period} onChange={(v) => router.replace(`/ranking?period=${v}`, { scroll: false })} />

      {error ? (
        <div className="rounded-2xl border bg-white p-4 text-center" style={{ borderColor: "#D0D7DE" }}>
          <p className="mb-3 text-sm" style={{ color: "#59636E" }}>
            랭킹을 불러오지 못했어요.
          </p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="min-h-11 rounded-lg px-4 text-sm font-medium text-white" style={{ background: "#1A7F37" }}>
            다시 시도
          </button>
        </div>
      ) : !data ? (
        <Skeleton />
      ) : (
        <>
          {data.hidden && (
            <p className="rounded-2xl border bg-white p-3 text-center text-sm" style={{ borderColor: "#D0D7DE", color: "#59636E" }}>
              랭킹에서 숨김 상태예요
            </p>
          )}
          {BOARDS.map(({ metric, title, hint }) => (
            <section key={metric} aria-labelledby={`board-${metric}`} className="space-y-2">
              <h2 id={`board-${metric}`} className="flex items-baseline gap-2 text-base font-bold" style={{ color: "#1F2328" }}>
                {title}
                <span className="text-xs font-normal" style={{ color: "#59636E" }}>
                  {hint}
                </span>
              </h2>
              <RankingList rows={data.boards[metric].rows} me={data.boards[metric].me} metric={metric} period={period} />
            </section>
          ))}
        </>
      )}
    </div>
  );
}

export default function RankingPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Ranking />
    </Suspense>
  );
}
