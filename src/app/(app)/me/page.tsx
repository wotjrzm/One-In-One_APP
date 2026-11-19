"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { logout } from "./actions";

type Me = {
  login: string;
  avatarUrl: string;
  repoName: string | null;
  repoUrl: string | null;
  repoStatus: "none" | "connected" | "disconnected";
  hideFromRanking: boolean;
};

const card = "rounded-2xl border bg-white p-4";
const cardStyle = { borderColor: "#D0D7DE" };

export default function MePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch("/api/me");
      if (!res.ok) throw new Error(String(res.status));
      setMe((await res.json()) as Me);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle() {
    if (!me || saving) return;
    const next = !me.hideFromRanking;
    setSaveError(false);
    setSaving(true);
    setMe({ ...me, hideFromRanking: next });
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hideFromRanking: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setMe((cur) => (cur ? { ...cur, hideFromRanking: !next } : cur));
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className={`${card} text-center`} style={cardStyle}>
        <p className="mb-3 text-sm" style={{ color: "#59636E" }}>
          내 정보를 불러오지 못했어요.
        </p>
        <button type="button" onClick={() => void load()} className="min-h-11 rounded-lg px-4 text-sm font-medium text-white" style={{ background: "#1A7F37" }}>
          다시 시도
        </button>
      </div>
    );
  }
  if (!me) {
    return (
      <div role="status" className="space-y-4">
        <span className="sr-only">불러오는 중</span>
        {[72, 64, 64].map((h, i) => (
          <div key={i} className="animate-pulse rounded-2xl" style={{ height: h, background: "#EBEEF1" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold" style={{ color: "#1F2328" }}>
        내 정보
      </h1>

      <div className={`${card} flex items-center gap-3`} style={cardStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={me.avatarUrl} alt="" width={48} height={48} className="h-12 w-12 rounded-full" style={{ background: "#EBEEF1" }} />
        <span className="text-base font-bold" style={{ color: "#1F2328" }}>
          {me.login}
        </span>
      </div>

      <div className={`${card} space-y-2`} style={cardStyle}>
        <p className="text-sm font-medium" style={{ color: "#59636E" }}>
          저장소
        </p>
        {me.repoUrl && (
          <a href={me.repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-medium underline" style={{ color: "#0969DA" }}>
            {me.repoName}
          </a>
        )}
        {me.repoStatus === "disconnected" && (
          <div>
            <Link href="/onboarding" className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium text-white" style={{ background: "#1A7F37" }}>
              저장소 다시 연결하기
            </Link>
          </div>
        )}
      </div>

      <div className={card} style={cardStyle}>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <span className="text-sm font-medium" style={{ color: "#1F2328" }}>
            랭킹에 나를 숨기기
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={me.hideFromRanking}
            aria-label="랭킹에 나를 숨기기"
            disabled={saving}
            onClick={() => void toggle()}
            className="relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60"
            style={{ background: me.hideFromRanking ? "#1A7F37" : "#D0D7DE" }}
          >
            <span className="absolute top-1 h-6 w-6 rounded-full bg-white transition-all" style={{ left: me.hideFromRanking ? "1.75rem" : "0.25rem" }} />
          </button>
        </div>
        {saveError && (
          <p role="alert" className="mt-2 text-sm font-medium" style={{ color: "#953800" }}>
            저장하지 못했어요. 다시 시도해 주세요.
          </p>
        )}
      </div>

      <form action={logout}>
        <button type="submit" className="min-h-12 w-full rounded-xl border bg-white text-base font-medium" style={{ borderColor: "#D0D7DE", color: "#CF222E" }}>
          로그아웃
        </button>
      </form>
    </div>
  );
}
