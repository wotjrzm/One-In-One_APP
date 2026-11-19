export const DISPLAY_NAME_MAX = 20;

/** Trim, collapse inner whitespace, 1..20 chars, no control characters. Returns null if invalid. */
export function normalizeDisplayName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input.replace(/\s+/g, " ").trim();
  if (/[\u0000-\u001f\u007f]/.test(name)) return null;
  const len = [...name].length;
  return len >= 1 && len <= DISPLAY_NAME_MAX ? name : null;
}
