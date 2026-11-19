import type { ProblemType } from "@/lib/types";
import type { SubmissionInput } from "@/lib/submission/validate";

export type UserRow = {
  id: string;
  githubId: number;
  login: string;
  avatarUrl: string;
  tokenEnc: string;
  repoName: string | null;
  repoStatus: "none" | "ok" | "disconnected";
  hideFromRanking: boolean;
};

export type AttemptRow = {
  id: string;
  userId: string;
  dateKst: string;
  type: ProblemType;
  problemId: string;
  isCorrect: boolean;
  payload: SubmissionInput;
  commitStatus: "pending" | "committed";
  commitSha: string | null;
  createdAt: string;
};

/** Attempt as needed for ranking/stats: no payload or commit sha. */
export type RankingAttempt = Omit<AttemptRow, "payload" | "commitSha">;

export class DuplicateCorrectError extends Error {
  constructor(message = "A correct attempt already exists for this user, date and type") {
    super(message);
    this.name = "DuplicateCorrectError";
  }
}

export interface Store {
  upsertUser(u: {
    githubId: number;
    login: string;
    avatarUrl: string;
    tokenEnc: string;
  }): Promise<UserRow>;
  getUser(id: string): Promise<UserRow | null>;
  updateUser(
    id: string,
    patch: Partial<Pick<UserRow, "repoName" | "repoStatus" | "hideFromRanking">>,
  ): Promise<void>;
  /** Throws DuplicateCorrectError if a correct attempt already exists for the same user/date/type. */
  insertAttempt(
    a: Omit<AttemptRow, "id" | "commitStatus" | "commitSha" | "createdAt">,
  ): Promise<AttemptRow>;
  markCommitted(attemptId: string, sha: string): Promise<void>;
  /** Ordered by createdAt ascending. */
  listAttempts(
    userId: string,
    opts?: { dateKst?: string; status?: "pending" | "committed" },
  ): Promise<AttemptRow[]>;
  /** Committed attempts only; only users with a repoName (hidden users included). */
  listRankingUsers(): Promise<(UserRow & { attempts: RankingAttempt[] })[]>;
  /** Ids of users with repoStatus 'ok' and at least one pending attempt. */
  listUsersWithPending(): Promise<string[]>;
}
