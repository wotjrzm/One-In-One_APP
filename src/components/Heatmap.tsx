export type HeatmapCell = { date: string; active: boolean };

/** Cells are chronological, Monday-first, 7 per week: column = week, row = weekday. */
export function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  return (
    <div
      role="img"
      aria-label={`최근 12주 동안 ${cells.filter((c) => c.active).length}일 학습`}
      className="grid justify-center gap-1"
      style={{ gridTemplateRows: "repeat(7, 14px)", gridAutoFlow: "column", gridAutoColumns: "14px" }}
    >
      {cells.map((c) => (
        <span
          key={c.date}
          title={c.date}
          style={{ width: 14, height: 14, borderRadius: 3, background: c.active ? "#2DA44E" : "#EBEEF1" }}
        />
      ))}
    </div>
  );
}
