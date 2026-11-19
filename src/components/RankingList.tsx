import type { RankRow } from "@/lib/stats/ranking";

export type RankMetric = "consistency" | "commits" | "accuracy";
export type RankPeriod = "week" | "all";

export const TOP_N = 10;

export function formatValue(row: Pick<RankRow, "primary" | "secondary" | "total">, metric: RankMetric, period: RankPeriod): string {
  if (metric === "consistency") {
    return period === "all" ? `${row.primary}일 · ${row.secondary ?? 0}%` : `${row.primary}일`;
  }
  if (metric === "accuracy") return `${row.primary}% (${row.secondary ?? 0}/${row.total ?? 0})`;
  return `${row.primary}회`;
}

function Name({ row }: { row: Pick<RankRow, "login" | "displayName"> }) {
  return (
    <span className="min-w-0 flex-1 truncate text-sm">
      {row.displayName ? (
        <>
          <span className="font-medium">{row.displayName}</span>
          <span style={{ color: "#59636E" }}> @{row.login}</span>
        </>
      ) : (
        <span className="font-medium">{row.login}</span>
      )}
    </span>
  );
}

export function RankingList({
  rows,
  metric,
  period,
  me,
}: {
  rows: RankRow[];
  metric: RankMetric;
  period: RankPeriod;
  me?: RankRow | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border bg-white p-6 text-center text-sm" style={{ borderColor: "#D0D7DE", color: "#59636E" }}>
        아직 랭킹에 오른 사람이 없어요
      </p>
    );
  }
  const top = rows.slice(0, TOP_N);
  const meOutside = me && !top.some((r) => r.userId === me.userId) ? me : null;
  const items = meOutside ? [...top, meOutside] : top;
  return (
    <ol className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "#D0D7DE" }}>
      {items.map((row, i) => (
        <li
          key={row.userId}
          style={{
            ...(i > 0 ? { borderTop: meOutside && i === items.length - 1 ? "2px dashed #D0D7DE" : "1px solid #D0D7DE" } : {}),
            ...(me && row.userId === me.userId ? { background: "#F0F9F2" } : {}),
          }}
        >
          <a
            href={row.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-14 items-center gap-3 px-4 py-2"
            style={{ color: "#1F2328" }}
          >
            <span className="w-7 shrink-0 text-center text-sm font-bold" style={{ color: row.rank <= 3 ? "#1A7F37" : "#59636E" }}>
              {row.rank}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={row.avatarUrl} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full" style={{ background: "#EBEEF1" }} />
            <Name row={row} />
            <span className="shrink-0 text-sm font-bold">{formatValue(row, metric, period)}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}
