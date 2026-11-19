import type { Store } from "@/lib/db/types";
import type { Problem } from "@/lib/problems/schema";
import type { Commit } from "@/lib/github/files";
import type { ProblemType } from "@/lib/types";

export type Deps = {
  store: Store;
  bank: Record<ProblemType, Problem[]>;
  now: () => Date;
  github: {
    commit(token: string, owner: string, repo: string, c: Commit): Promise<string>;
    ensureRepo(token: string, owner: string, name: string): Promise<"created" | "existing" | "conflict">;
  };
};

export type SubmitResult =
  | { ok: true; isCorrect: boolean; commit: { status: "committed"; url: string } | { status: "pending" } | { status: "disconnected" } }
  | { ok: false; status: 400; error: "empty" }
  | { ok: false; status: 404; error: "no_problem" }
  | { ok: false; status: 409; error: "date_changed" | "already_solved" }
  | { ok: false; status: 412; error: "repo_not_ready" };
