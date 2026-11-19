"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RepoForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { result?: "ok" | "conflict" | "invalid" };
      if (res.ok && data.result === "ok") {
        router.push("/");
        return;
      }
      setError(
        data.result === "conflict"
          ? "그 이름의 저장소도 이미 있어요. 다른 이름을 입력해 주세요."
          : "저장소 이름을 확인해 주세요.",
      );
    } catch {
      setError("잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="저장소 이름"
        className="min-h-12 rounded-lg border border-[#D0D7DE] px-3 text-base"
      />
      {error && <p className="text-sm text-[#BC4C00]">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="min-h-12 rounded-lg bg-[#1A7F37] px-4 text-base font-medium text-white disabled:opacity-60"
      >
        확인
      </button>
    </form>
  );
}
