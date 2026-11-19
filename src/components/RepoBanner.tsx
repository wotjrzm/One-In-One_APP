import Link from "next/link";

export function RepoBanner() {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
      style={{ background: "#FFF1E5", borderColor: "#D0D7DE", color: "#953800" }}
    >
      <p className="text-sm font-medium">저장소 연결이 끊겼어요</p>
      <Link
        href="/onboarding"
        className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-white px-3 text-sm font-medium"
        style={{ border: "1px solid #D0D7DE", color: "#1F2328" }}
      >
        저장소 다시 연결하기
      </Link>
    </div>
  );
}
