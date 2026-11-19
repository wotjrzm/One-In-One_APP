import { Octokit } from "@octokit/rest";
import { MARKER_FILE } from "@/lib/types";
import type { Commit } from "./files";

export class RepoAccessError extends Error {
  constructor(message = "GitHub repository access failed") {
    super(message);
    this.name = "RepoAccessError";
  }
}

export function octokitFor(token: string): Octokit {
  return new Octokit({ auth: token });
}

const statusOf = (e: unknown): number | undefined =>
  typeof e === "object" && e !== null && "status" in e ? (e as { status: number }).status : undefined;

const MARKER_ATTEMPTS = 5;
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function ensureRepo(
  gh: Octokit,
  owner: string,
  name: string,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<"created" | "existing" | "conflict"> {
  try {
    await gh.rest.repos.get({ owner, repo: name });
  } catch (e) {
    if (statusOf(e) !== 404) throw e;
    await gh.rest.repos.createForAuthenticatedUser({
      name,
      private: false,
      auto_init: true,
      description: "1일 1학습 기록 (One-In-One)",
    });
    // auto_init's first commit may not be ready yet; retry the marker write on 404/409.
    for (let attempt = 1; ; attempt++) {
      try {
        await gh.rest.repos.createOrUpdateFileContents({
          owner,
          repo: name,
          path: MARKER_FILE,
          message: "chore: add One-In-One marker",
          content: Buffer.from("One-In-One study repository\n", "utf8").toString("base64"),
        });
        break;
      } catch (err) {
        const s = statusOf(err);
        if ((s !== 404 && s !== 409) || attempt >= MARKER_ATTEMPTS) throw err;
        await sleep(500 * attempt);
      }
    }
    return "created";
  }

  try {
    await gh.rest.repos.getContent({ owner, repo: name, path: MARKER_FILE });
    return "existing";
  } catch (e) {
    if (statusOf(e) === 404) return "conflict";
    throw e;
  }
}

export async function commitFiles(
  gh: Octokit,
  owner: string,
  repo: string,
  c: Commit,
): Promise<string> {
  try {
    const { data: info } = await gh.rest.repos.get({ owner, repo });
    const branch = info.default_branch;
    const { data: ref } = await gh.rest.git.getRef({ owner, repo, ref: `heads/${branch}` });
    const { data: head } = await gh.rest.git.getCommit({ owner, repo, commit_sha: ref.object.sha });
    const { data: tree } = await gh.rest.git.createTree({
      owner,
      repo,
      base_tree: head.tree.sha,
      tree: c.files.map((f) => ({
        path: f.path,
        mode: "100644" as const,
        type: "blob" as const,
        content: f.content,
      })),
    });
    const { data: commit } = await gh.rest.git.createCommit({
      owner,
      repo,
      message: c.message,
      tree: tree.sha,
      parents: [ref.object.sha],
    });
    await gh.rest.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
    return commit.sha;
  } catch (e) {
    const s = statusOf(e);
    if (s === 401 || s === 403 || s === 404) {
      throw new RepoAccessError(`GitHub responded ${s}`);
    }
    throw e;
  }
}
