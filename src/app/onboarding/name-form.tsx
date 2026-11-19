"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DISPLAY_NAME_MAX } from "@/lib/profile";

export function NameForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      setError(res.status === 400 ? `이름은 1~${DISPLAY_NAME_MAX}자로 입력해 주세요.` : "잠시 후 다시 시도해 주세요.");
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
        aria-label="표시 이름"
        placeholder="예: 홍길동"
        maxLength={DISPLAY_NAME_MAX * 2}
        autoComplete="nickname"
        className="min-h-12 rounded-lg border border-[#D0D7DE] px-3 text-base"
      />
      {error && <p className="text-sm text-[#BC4C00]">{error}</p>}
      <button
        type="submit"
        disabled={busy || name.trim() === ""}
        className="min-h-12 rounded-lg bg-[#1A7F37] px-4 text-base font-medium text-white disabled:opacity-60"
      >
        다음
      </button>
    </form>
  );
}
