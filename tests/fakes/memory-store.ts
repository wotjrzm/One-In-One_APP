import { randomUUID } from "node:crypto";
import {
  DuplicateCorrectError,
  type AttemptRow,
  type Store,
  type UserRow,
} from "@/lib/db/types";

const byCreatedThenId = (x: AttemptRow, y: AttemptRow) =>
  x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id);

/** In-memory Store with the same semantics as the Supabase implementation. */
export class MemoryStore implements Store {
  private users = new Map<string, UserRow>();
  private attempts: AttemptRow[] = [];
  private clock = Date.UTC(2026, 0, 1);

  async upsertUser(u: { githubId: number; login: string; avatarUrl: string; tokenEnc: string }) {
    const existing = [...this.users.values()].find((x) => x.githubId === u.githubId);
    if (existing) {
      Object.assign(existing, { login: u.login, avatarUrl: u.avatarUrl, tokenEnc: u.tokenEnc });
      return { ...existing };
    }
    const row: UserRow = {
      id: randomUUID(),
      ...u,
      repoName: null,
      repoStatus: "none",
      hideFromRanking: false,
    };
    this.users.set(row.id, row);
    return { ...row };
  }

  async getUser(id: string) {
    const u = this.users.get(id);
    return u ? { ...u } : null;
  }

  async updateUser(
    id: string,
    patch: Partial<Pick<UserRow, "repoName" | "repoStatus" | "hideFromRanking">>,
  ) {
    const u = this.users.get(id);
    if (!u) return;
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) Object.assign(u, { [k]: v });
  }

  async insertAttempt(a: Omit<AttemptRow, "id" | "commitStatus" | "commitSha" | "createdAt">) {
    if (
      a.isCorrect &&
      this.attempts.some(
        (x) => x.isCorrect && x.userId === a.userId && x.dateKst === a.dateKst && x.type === a.type,
      )
    ) {
      throw new DuplicateCorrectError();
    }
    this.clock += 1000;
    const row: AttemptRow = {
      ...a,
      id: randomUUID(),
      commitStatus: "pending",
      commitSha: null,
      createdAt: new Date(this.clock).toISOString(),
    };
    this.attempts.push(row);
    return { ...row };
  }

  async markCommitted(attemptId: string, sha: string) {
    const a = this.attempts.find((x) => x.id === attemptId);
    if (a) Object.assign(a, { commitStatus: "committed", commitSha: sha });
  }

  async listAttempts(userId: string, opts?: { dateKst?: string; status?: "pending" | "committed" }) {
    return this.attempts
      .filter(
        (a) =>
          a.userId === userId &&
          (!opts?.dateKst || a.dateKst === opts.dateKst) &&
          (!opts?.status || a.commitStatus === opts.status),
      )
      .sort(byCreatedThenId)
      .map((a) => ({ ...a }));
  }

  async listRankingUsers() {
    return [...this.users.values()]
      .filter((u) => u.repoName !== null)
      .map((u) => ({
        ...u,
        attempts: this.attempts
          .filter((a) => a.userId === u.id && a.commitStatus === "committed")
          .sort(byCreatedThenId)
          .map((a) => ({ ...a })),
      }));
  }

  async listUsersWithPending() {
    return [...this.users.values()]
      .filter(
        (u) =>
          u.repoStatus === "ok" &&
          this.attempts.some((a) => a.userId === u.id && a.commitStatus === "pending"),
      )
      .map((u) => u.id);
  }
}
