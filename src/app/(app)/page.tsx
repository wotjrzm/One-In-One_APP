"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Heatmap, type HeatmapCell } from "@/components/Heatmap";
import { RepoBanner } from "@/components/RepoBanner";
import { StreakBadge } from "@/components/StreakBadge";
import type { ProblemType } from "@/lib/types";

type Status = "correct" | "wrong" | "none";
type TodayItem = { type: ProblemType; label: string; problem: unknown | null; status: Status };
type Today = {
  date: string;
  items: TodayItem[];
  streak: number;
  heatmap: HeatmapCell[];
  repo: { name: string | null; status: "none" | "connected" | "disconnected" };
  needsName?: boolean;
};

const BADGE: Record<Status, { text: string; bg: string; fg: string }> = {
  correct: { text: "정답", bg: "#DAFBE1", fg: "#116329" },
  wrong: { text: "오답", bg: "#FFF1E5", fg: "#953800" },
  none: { text: "안 풂", bg: "#EBEEF1", fg: "#59636E" },
};

const card = "rounded-2xl border bg-white p-4";
const cardStyle = { borderColor: "#D0D7DE" };

function subText(type: ProblemType) {
  return type === "coding-test" ? "Python · 테스트 케이스 채점" : "객관식";
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#59636E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function Skeleton() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">불러오는 중</span>
      {[96, 176, 320].map((h) => (
        <div key={h} className="animate-pulse rounded-2xl" style={{ height: h, background: "#EBEEF1" }} />
      ))}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<Today | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/today");
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as Today;
      if (json.repo.status === "none" || json.needsName) {
        router.replace("/onboarding");
        return;
      }
      setData(json);
    } catch {
      setError(true);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className={`${card} text-center`} style={cardStyle}>
        <p className="mb-3 text-sm" style={{ color: "#59636E" }}>
          오늘의 문제를 불러오지 못했어요.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="min-h-11 rounded-lg px-4 text-sm font-medium text-white"
          style={{ background: "#1A7F37" }}
        >
          다시 시도
        </button>
      </div>
    );
  }
  if (!data) return <Skeleton />;

  const done = data.items.filter((i) => i.status === "correct").length;
  const total = data.items.filter((i) => i.problem !== null).length;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">1일 1학습</h1>
        <StreakBadge streak={data.streak} />
      </header>

      {data.repo.status === "disconnected" && <RepoBanner />}

      <section className={card} style={cardStyle}>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-bold">최근 12주 기록</h2>
          <span className="text-xs" style={{ color: "#59636E" }}>
            깃허브 잔디와 같아요
          </span>
        </div>
        <Heatmap cells={data.heatmap} />
      </section>

      <section className={card} style={cardStyle}>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-base font-bold">오늘의 문제</h2>
          <span className="text-sm font-medium" style={{ color: "#59636E" }}>
            {done} / {total} 완료
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          className="mb-3 h-2 overflow-hidden rounded-full"
          style={{ background: "#D0D7DE" }}
        >
          <div className="h-full rounded-full" style={{ width: `${total ? (done / total) * 100 : 0}%`, background: "#1A7F37" }} />
        </div>
        <ul className="space-y-2">
          {data.items.map((item) => {
            const badge = item.problem ? BADGE[item.status] : { ...BADGE.none, text: "준비 중" };
            const body = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium">{item.label}</span>
                  <span className="block text-xs" style={{ color: "#59636E" }}>
                    {subText(item.type)}
                  </span>
                </span>
                <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: badge.bg, color: badge.fg }}>
                  {badge.text}
                </span>
                {item.problem ? <Chevron /> : null}
              </>
            );
            const rowClass = "flex min-h-16 items-center gap-3 rounded-xl border px-3 py-2";
            return (
              <li key={item.type}>
                {item.problem ? (
                  <Link href={`/solve/${item.type}`} className={rowClass} style={cardStyle}>
                    {body}
                  </Link>
                ) : (
                  <div aria-disabled="true" className={rowClass} style={{ ...cardStyle, borderStyle: "dashed" }}>
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
