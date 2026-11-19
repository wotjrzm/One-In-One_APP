import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const selects: { table: string; cols: string | undefined }[] = [];
const tables: Record<string, unknown[]> = {
  users: [
    { id: "u1", github_id: 1, login: "a", avatar_url: "x", token_enc: "t", repo_name: "R", repo_status: "ok", hide_from_ranking: false },
  ],
  attempts: [
    { id: "a1", user_id: "u1", date_kst: "2026-11-19", type: "ai", problem_id: "ai-001", is_correct: true, commit_status: "committed", created_at: "2026-11-19T00:00:00Z" },
  ],
};

function builder(table: string) {
  const b: Record<string, unknown> = {
    select: (cols?: string) => {
      selects.push({ table, cols });
      return b;
    },
    not: () => b,
    eq: () => b,
    order: () => b,
    range: () => Promise.resolve({ data: tables[table], error: null }),
  };
  return b;
}

vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: (t: string) => builder(t) }) }));

import { getStore } from "@/lib/db/supabase-store";

describe("SupabaseStore.listRankingUsers", () => {
  it("selects only the attempt columns ranking needs (no payload)", async () => {
    process.env.SUPABASE_URL = "http://x";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
    const rows = await getStore().listRankingUsers();
    const cols = selects.find((s) => s.table === "attempts")!.cols;
    expect(cols).toBeDefined();
    expect(cols!.split(",").map((c) => c.trim()).sort()).toEqual(
      ["commit_status", "created_at", "date_kst", "id", "is_correct", "problem_id", "type", "user_id"].sort(),
    );
    expect(rows[0].attempts[0]).toMatchObject({ id: "a1", userId: "u1", isCorrect: true, commitStatus: "committed" });
    expect(rows[0].attempts[0]).not.toHaveProperty("payload");
  });
});
