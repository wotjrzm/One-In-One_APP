export function StreakBadge({ streak }: { streak: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium"
      style={{ background: "#DAFBE1", color: "#116329" }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 1.5 1 2.5 2 2.5C11 9 11 6 12 3z" />
      </svg>
      {streak}일 연속
    </span>
  );
}
