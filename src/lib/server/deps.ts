import { getStore } from "@/lib/db/supabase-store";
import { loadBank } from "@/lib/problems/bank";
import { commitFiles, ensureRepo, octokitFor } from "@/lib/github/client";
import type { Deps } from "@/lib/services/types";

export function getDeps(): Deps {
  return {
    store: getStore(),
    bank: loadBank(),
    now: () => new Date(),
    github: {
      commit: (token, owner, repo, c) => commitFiles(octokitFor(token), owner, repo, c),
      ensureRepo: (token, owner, name) => ensureRepo(octokitFor(token), owner, name),
    },
  };
}
