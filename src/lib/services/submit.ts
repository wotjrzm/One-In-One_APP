import { toKstDate } from "@/lib/date";
import { decryptToken } from "@/lib/crypto";
import { getDailyProblem } from "@/lib/problems/bank";
import { DuplicateCorrectError } from "@/lib/db/types";
import { RepoAccessError } from "@/lib/github/client";
import { buildCommit } from "@/lib/github/files";
import { gradeChoice } from "@/lib/submission/grade";
import { isEmptySubmission, type SubmissionInput } from "@/lib/submission/validate";
import type { ProblemType } from "@/lib/types";
import type { Deps, SubmitResult } from "./types";

export async function submit(
  deps: Deps,
  userId: string,
  body: { type: ProblemType; problemId: string; input: SubmissionInput },
): Promise<SubmitResult> {
  const user = await deps.store.getUser(userId);
  if (!user || user.repoStatus !== "ok" || !user.repoName) {
    return { ok: false, status: 412, error: "repo_not_ready" };
  }
  const dateKst = toKstDate(deps.now());
  const problem = getDailyProblem(deps.bank, body.type, dateKst);
  if (!problem) return { ok: false, status: 404, error: "no_problem" };
  if (problem.id !== body.problemId) return { ok: false, status: 409, error: "date_changed" };
  if (isEmptySubmission(body.input, problem)) return { ok: false, status: 400, error: "empty" };

  const today = await deps.store.listAttempts(userId, { dateKst });
  if (today.some((a) => a.type === body.type && a.isCorrect)) {
    return { ok: false, status: 409, error: "already_solved" };
  }

  const { input } = body;
  const isCorrect =
    problem.type === "coding-test"
      ? input.kind === "code" && input.passed
      : input.kind === "choice" && gradeChoice(problem, input.choiceIndex);

  let attempt;
  try {
    attempt = await deps.store.insertAttempt({
      userId,
      dateKst,
      type: body.type,
      problemId: problem.id,
      isCorrect,
      payload: input,
    });
  } catch (e) {
    if (e instanceof DuplicateCorrectError) {
      return { ok: false, status: 409, error: "already_solved" };
    }
    throw e;
  }

  let sha: string;
  try {
    const commit = buildCommit({ dateKst, problem, input, isCorrect });
    sha = await deps.github.commit(decryptToken(user.tokenEnc), user.login, user.repoName, commit);
  } catch (e) {
    if (e instanceof RepoAccessError) {
      await deps.store.updateUser(userId, { repoStatus: "disconnected" });
    } else {
      console.error(`commit failed for attempt ${attempt.id}`, e);
    }
    return { ok: true, isCorrect, commit: { status: "pending" } };
  }
  await deps.store.markCommitted(attempt.id, sha);
  return {
    ok: true,
    isCorrect,
    commit: { status: "committed", url: `https://github.com/${user.login}/${user.repoName}/commit/${sha}` },
  };
}

export async function getExplanation(
  deps: Deps,
  userId: string,
  type: ProblemType,
): Promise<{ ok: true; explanation: string; answerIndex?: number } | { ok: false; status: 403 | 404 }> {
  const dateKst = toKstDate(deps.now());
  const problem = getDailyProblem(deps.bank, type, dateKst);
  if (!problem) return { ok: false, status: 404 };
  const attempts = await deps.store.listAttempts(userId, { dateKst });
  if (!attempts.some((a) => a.type === type && a.problemId === problem.id)) {
    return { ok: false, status: 403 };
  }
  return problem.type === "coding-test"
    ? { ok: true, explanation: problem.explanation }
    : { ok: true, explanation: problem.explanation, answerIndex: problem.answerIndex };
}
