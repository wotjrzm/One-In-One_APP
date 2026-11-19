import fs from "node:fs";
import path from "node:path";
import { PROBLEM_TYPES, ROTATION_EPOCH, type ProblemType } from "@/lib/types";
import { daysBetween } from "@/lib/date";
import {
  parseProblem,
  type ChoiceProblem,
  type CodingProblem,
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

  const bank = {} as Bank;
  for (const type of PROBLEM_TYPES) {
    const typeDir = path.join(root, type);
    const files = fs.existsSync(typeDir)
      ? fs.readdirSync(typeDir).filter((f) => f.endsWith(".json"))
      : [];
    bank[type] = files
      .map((f) => {
        const problem = parseProblem(JSON.parse(fs.readFileSync(path.join(typeDir, f), "utf8")));
        if (`${problem.id}.json` !== f) {
          throw new Error(`Problem ${problem.id}: filename ${f} does not match id`);
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
  if (p.type === "coding-test") {
    const pub: Partial<CodingProblem> = { ...p };
    delete pub.explanation;
    delete pub.reviewed;
    return pub as PublicProblem;
  }
  const pub: Partial<ChoiceProblem> = { ...p };
  delete pub.answerIndex;
  delete pub.explanation;
  delete pub.reviewed;
  return pub as PublicProblem;
}
