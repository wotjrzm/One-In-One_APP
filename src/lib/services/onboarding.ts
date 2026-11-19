import { decryptToken } from "@/lib/crypto";
import { DEFAULT_REPO, FALLBACK_REPO } from "@/lib/types";
import { retryPending } from "./retry";
import type { Deps } from "./types";

const REPO_NAME = /^[A-Za-z0-9._-]{1,100}$/;

export async function connectRepo(
  deps: Deps,
  userId: string,
  name: string,
): Promise<"ok" | "conflict" | "invalid"> {
  if (!REPO_NAME.test(name) || /^\.+$/.test(name)) return "invalid";
  const user = await deps.store.getUser(userId);
  if (!user) return "invalid";
  const result = await deps.github.ensureRepo(decryptToken(user.tokenEnc), user.login, name);
  if (result === "conflict") return "conflict";
  await deps.store.updateUser(userId, { repoName: name, repoStatus: "ok" });
  await retryPending(deps, userId);
  return "ok";
}

export type OnboardingStart =
  | { kind: "done" }
  | { kind: "form"; defaultName: string; reason: "conflict" | "error" }
  | { kind: "relogin" };

export async function startOnboarding(deps: Deps, userId: string): Promise<OnboardingStart> {
  const user = await deps.store.getUser(userId);
  if (!user) return { kind: "relogin" };
  if (user.repoStatus === "ok") return { kind: "done" };
  const name = user.repoName ?? DEFAULT_REPO;
  try {
    const result = await connectRepo(deps, userId, name);
    if (result === "ok") return { kind: "done" };
    if (result === "conflict") return { kind: "form", defaultName: FALLBACK_REPO, reason: "conflict" };
    return { kind: "relogin" };
  } catch (e) {
    console.error(`onboarding connect failed for user ${userId}`, e);
    return { kind: "form", defaultName: name, reason: "error" };
  }
}
