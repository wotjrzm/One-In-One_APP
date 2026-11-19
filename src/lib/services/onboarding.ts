import { decryptToken } from "@/lib/crypto";
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
