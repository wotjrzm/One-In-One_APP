export type ProblemType = "ai" | "network" | "claude-code" | "coding-test";

export const PROBLEM_TYPES: readonly ProblemType[] = [
  "ai",
  "network",
  "claude-code",
  "coding-test",
];

export const TYPE_LABELS: Record<ProblemType, string> = {
  ai: "AI",
  network: "네트워크",
  "claude-code": "Claude Code",
  "coding-test": "코딩 테스트",
};

export const DEFAULT_REPO = "One-In-One";
export const FALLBACK_REPO = "One-In-One-2";
export const MARKER_FILE = ".one-in-one";
export const WRONG_COMMIT_CAP = 4;
export const ROTATION_EPOCH = "2026-01-05";
