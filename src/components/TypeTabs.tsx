import Link from "next/link";
import type { ProblemType } from "@/lib/types";

export type TabItem = { type: ProblemType; label: string; status: "correct" | "wrong" | "none" };

export function TypeTabs({ items, current }: { items: TabItem[]; current: ProblemType }) {
  return (
    <div role="tablist" aria-label="문제 유형" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {items.map((item) => {
        const on = item.type === current;
        return (
          <Link
            key={item.type}
            href={`/solve/${item.type}`}
            role="tab"
            aria-selected={on}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border px-4 text-sm"
            style={{
              borderColor: on ? "#1F2328" : "#D0D7DE",
              background: on ? "#1F2328" : "#fff",
              color: on ? "#fff" : "#59636E",
              fontWeight: on ? 700 : 500,
            }}
          >
            {item.label}
            {item.status === "correct" && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={on ? "#fff" : "#1A7F37"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="완료">
                <path d="M5 12l5 5 9-10" />
              </svg>
            )}
          </Link>
        );
      })}
    </div>
  );
}
