const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function parse(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function format(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** KST(Asia/Seoul) calendar date (YYYY-MM-DD) for the given instant. */
export function toKstDate(now: Date): string {
  return format(now.getTime() + KST_OFFSET_MS);
}

export function addDays(date: string, n: number): string {
  return format(parse(date) + n * DAY_MS);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to) - parse(from)) / DAY_MS);
}

/** Monday of the week containing `date`. */
export function weekStartKst(date: string): string {
  const dow = new Date(parse(date)).getUTCDay(); // 0=Sun
  return addDays(date, -((dow + 6) % 7));
}
