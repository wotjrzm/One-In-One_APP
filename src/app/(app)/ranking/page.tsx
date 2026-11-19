"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { RankingList, formatValue, type RankMetric, type RankPeriod } from "@/components/RankingList";
import type { RankRow } from "@/lib/stats/ranking";

type Data = { rows: RankRow[]; me: RankRow | null; hidden: boolean };

const PERIODS: { value: RankPeriod; label: string }[] = [
  { value: "week", label: "이번 주" },
  { value: "all", label: "전체" },
];
const METRICS: { value: RankMetric; label: string }[] = [
  { value: "consistency", label: "꾸준성" },
  { value: "problems", label: "도전 문제" },
  { value: "commits", label: "커밋" },
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

function Tabs<T extends string>({ label, items, value, onChange }: { label: string; items: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-2">
      {items.map((item) => {
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
  const m = sp.get("metric");
  const metric: RankMetric = m === "problems" || m === "commits" ? m : "consistency";

  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setData(null);
    setError(false);
    (async () => {
      try {
        const res = await fetch(`/api/ranking?period=${period}&metric=${metric}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as Data;
        if (!ctrl.signal.aborted) setData(json);
      } catch {
        if (!ctrl.signal.aborted) setError(true);
      }
    })();
    return () => ctrl.abort();
  }, [period, metric, attempt]);

  const go = (next: { period?: RankPeriod; metric?: RankMetric }) =>
    router.replace(`/ranking?period=${next.period ?? period}&metric=${next.metric ?? metric}`, { scroll: false });

  return (
    <div className="space-y-4" style={{ paddingBottom: "4rem" }}>
      <h1 className="text-xl font-bold" style={{ color: "#1F2328" }}>
        랭킹
      </h1>
      <div className="space-y-2">
        <Tabs label="기간" items={PERIODS} value={period} onChange={(v) => go({ period: v })} />
        <Tabs label="기준" items={METRICS} value={metric} onChange={(v) => go({ metric: v })} />
      </div>

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
          <RankingList rows={data.rows} metric={metric} period={period} />
          {(data.hidden || data.me) && (
            <div
              className="fixed inset-x-0 z-10 border-t bg-white px-4 py-3"
              style={{ bottom: "calc(3.5rem + 1px + env(safe-area-inset-bottom))", borderColor: "#D0D7DE" }}
            >
              <div className="mx-auto flex max-w-[448px] items-center justify-between text-sm font-bold" style={{ color: "#1F2328" }}>
                {data.hidden ? (
                  <span style={{ color: "#59636E" }}>랭킹에서 숨김 상태예요</span>
                ) : (
                  data.me && (
                    <>
                      <span>나 {data.me.rank}위</span>
                      <span>{formatValue(data.me, metric, period)}</span>
                    </>
                  )
                )}
              </div>
            </div>
          )}
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
