import fs from "node:fs";
import path from "node:path";
import { PROBLEM_TYPES, ROTATION_EPOCH, type ProblemType } from "@/lib/types";
import { daysBetween } from "@/lib/date";
import {
  parseProblem,
  type Problem,
  type PublicProblem,
} from "./schema";

export type Bank = Record<ProblemType, Problem[]>;

const cache = new Map<string, Bank>();

/** Server-only. Reads `<dir>/<type>/<id>.json`, memoized per resolved directory. */
export function loadBank(dir = "content/problems"): Bank {
  const root = path.resolve(dir);
  const hit = cache.get(root);
  if (hit) return hit;

  if (!fs.existsSync(root)) {
    throw new Error(
      `Problem bank directory not found: ${root}. Is content/problems traced into the deployment (outputFileTracingIncludes)?`,
    );
  }

  const bank = {} as Bank;
  for (const type of PROBLEM_TYPES) {
    const typeDir = path.join(root, type);
    const files = fs.existsSync(typeDir)
      ? fs.readdirSync(typeDir).filter((f) => f.endsWith(".json"))
      : [];
    bank[type] = files
      .map((f) => {
        const file = path.join(typeDir, f);
        let raw: unknown;
        try {
          raw = JSON.parse(fs.readFileSync(file, "utf8"));
        } catch (e) {
          throw new Error(`Cannot read problem file ${file}: ${(e as Error).message}`);
        }
        const problem = parseProblem(raw);
        if (`${problem.id}.json` !== f) {
          throw new Error(`Problem ${problem.id}: filename ${file} does not match id`);
        }
        if (problem.type !== type) {
          throw new Error(`Problem ${problem.id}: type ${problem.type} does not match directory ${type} (${file})`);
        }
        return problem;
      })
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  cache.set(root, bank);
  return bank;
}

export function getDailyProblem(bank: Bank, type: ProblemType, date: string): Problem | null {
  const pool = bank[type].filter((p) => p.reviewed);
  const n = pool.length;
  if (n === 0) return null;
  const idx = ((daysBetween(ROTATION_EPOCH, date) % n) + n) % n;
  return pool[idx];
}

export function toPublicProblem(p: Problem): PublicProblem {
  const { id, title, prompt } = p;
  if (p.type === "coding-test") {
    const { examples, starterCode, functionName, tests } = p;
    return { id, type: p.type, title, prompt, examples, starterCode, functionName, tests };
  }
  return { id, type: p.type, title, prompt, choices: p.choices };
}
