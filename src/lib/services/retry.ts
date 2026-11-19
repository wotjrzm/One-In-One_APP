import { RepoAccessError } from "@/lib/github/client";
import { buildCommit } from "@/lib/github/files";
import { decryptToken } from "@/lib/crypto";
import type { Deps } from "./types";

export async function retryPending(
  deps: Deps,
  userId: string,
): Promise<{ committed: number; stopped: boolean }> {
  const user = await deps.store.getUser(userId);
  if (!user || user.repoStatus !== "ok" || !user.repoName) return { committed: 0, stopped: false };
  const token = decryptToken(user.tokenEnc);
  const pending = await deps.store.listAttempts(userId, { status: "pending" });
  let committed = 0;
  for (const attempt of pending) {
    const problem = deps.bank[attempt.type].find((p) => p.id === attempt.problemId);
    if (!problem) continue;
    const commit = buildCommit({
      dateKst: attempt.dateKst,
      problem,
      input: attempt.payload,
      isCorrect: attempt.isCorrect,
    });
    try {
      const sha = await deps.github.commit(token, user.login, user.repoName, commit);
      await deps.store.markCommitted(attempt.id, sha);
      committed++;
    } catch (e) {
      if (e instanceof RepoAccessError) {
        await deps.store.updateUser(userId, { repoStatus: "disconnected" });
        return { committed, stopped: true };
      }
    }
  }
  return { committed, stopped: false };
}

export async function retryAll(deps: Deps): Promise<void> {
  for (const id of await deps.store.listUsersWithPending()) {
    await retryPending(deps, id);
  }
}
