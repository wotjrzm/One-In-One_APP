import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DuplicateCorrectError,
  type AttemptRow,
  type Store,
  type UserRow,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const toUser = (r: Row): UserRow => ({
  id: r.id,
  githubId: Number(r.github_id),
  login: r.login,
  avatarUrl: r.avatar_url,
  tokenEnc: r.token_enc,
  repoName: r.repo_name,
  repoStatus: r.repo_status,
  hideFromRanking: r.hide_from_ranking,
});

const toAttempt = (r: Row): AttemptRow => ({
  id: r.id,
  userId: r.user_id,
  dateKst: r.date_kst,
  type: r.type,
  problemId: r.problem_id,
  isCorrect: r.is_correct,
  payload: r.payload,
  commitStatus: r.commit_status,
  commitSha: r.commit_sha,
  createdAt: r.created_at,
});

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(`Supabase error: ${res.error.message}`);
  return res.data;
}

const PAGE = 1000;

/** PostgREST caps unpaginated selects at max_rows; loop with range() until a short page. */
async function fetchAll(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: any; error: { message: string; code?: string } | null }>,
): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = check(await page(from, from + PAGE - 1)) as Row[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

class SupabaseStore implements Store {
  constructor(private db: SupabaseClient) {}

  async upsertUser(u: { githubId: number; login: string; avatarUrl: string; tokenEnc: string }) {
    const res = await this.db
      .from("users")
      .upsert(
        { github_id: u.githubId, login: u.login, avatar_url: u.avatarUrl, token_enc: u.tokenEnc },
        { onConflict: "github_id" },
      )
      .select()
      .single();
    return toUser(check(res));
  }

  async getUser(id: string) {
    const res = await this.db.from("users").select().eq("id", id).maybeSingle();
    const data = check(res);
    return data ? toUser(data) : null;
  }

  async updateUser(
    id: string,
    patch: Partial<Pick<UserRow, "repoName" | "repoStatus" | "hideFromRanking">>,
  ) {
    const row: Row = {};
    if (patch.repoName !== undefined) row.repo_name = patch.repoName;
    if (patch.repoStatus !== undefined) row.repo_status = patch.repoStatus;
    if (patch.hideFromRanking !== undefined) row.hide_from_ranking = patch.hideFromRanking;
    if (Object.keys(row).length === 0) return;
    check(await this.db.from("users").update(row).eq("id", id));
  }

  async insertAttempt(a: Omit<AttemptRow, "id" | "commitStatus" | "commitSha" | "createdAt">) {
    const res = await this.db
      .from("attempts")
      .insert({
        user_id: a.userId,
        date_kst: a.dateKst,
        type: a.type,
        problem_id: a.problemId,
        is_correct: a.isCorrect,
        payload: a.payload,
      })
      .select()
      .single();
    if (res.error?.code === "23505") throw new DuplicateCorrectError();
    return toAttempt(check(res));
  }

  async markCommitted(attemptId: string, sha: string) {
    check(
      await this.db
        .from("attempts")
        .update({ commit_status: "committed", commit_sha: sha })
        .eq("id", attemptId),
    );
  }

  async listAttempts(userId: string, opts?: { dateKst?: string; status?: "pending" | "committed" }) {
    const data = await fetchAll((from, to) => {
      let q = this.db.from("attempts").select().eq("user_id", userId);
      if (opts?.dateKst) q = q.eq("date_kst", opts.dateKst);
      if (opts?.status) q = q.eq("commit_status", opts.status);
      return q
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
    });
    return data.map(toAttempt);
  }

  async listRankingUsers() {
    const users = await fetchAll((from, to) =>
      this.db
        .from("users")
        .select()
        .not("repo_name", "is", null)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
    if (users.length === 0) return [];
    const attempts = await fetchAll((from, to) =>
      this.db
        .from("attempts")
        .select()
        .eq("commit_status", "committed")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
    const byUser = new Map<string, AttemptRow[]>();
    for (const r of attempts) {
      const list = byUser.get(r.user_id) ?? [];
      list.push(toAttempt(r));
      byUser.set(r.user_id, list);
    }
    return users.map((u) => ({ ...toUser(u), attempts: byUser.get(u.id) ?? [] }));
  }

  async listUsersWithPending() {
    const pending = await fetchAll((from, to) =>
      this.db
        .from("attempts")
        .select("id, user_id, created_at")
        .eq("commit_status", "pending")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
    const ids = new Set(pending.map((r) => r.user_id as string));
    if (ids.size === 0) return [];
    const ok = await fetchAll((from, to) =>
      this.db
        .from("users")
        .select("id, created_at")
        .eq("repo_status", "ok")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
    return ok.map((u) => u.id as string).filter((id) => ids.has(id));
  }
}

let singleton: Store | undefined;

export function getStore(): Store {
  if (!singleton) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    }
    singleton = new SupabaseStore(
      createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    );
  }
  return singleton;
}
