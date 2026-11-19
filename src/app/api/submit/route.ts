import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDeps } from "@/lib/server/deps";
import { submit } from "@/lib/services/submit";
import { PROBLEM_TYPES, type ProblemType } from "@/lib/types";
import type { SubmissionInput } from "@/lib/submission/validate";

const bad = () => NextResponse.json({ error: "bad_request" }, { status: 400 });

const MAX_CODE_CHARS = 20000;
const MAX_RESULTS = 50;
const MAX_RESULT_TEXT = 200;

function parseInput(v: unknown): SubmissionInput | null {
  if (!v || typeof v !== "object") return null;
  const i = v as Record<string, unknown>;
  if (i.kind === "choice") {
    return Number.isInteger(i.choiceIndex)
      ? { kind: "choice", choiceIndex: i.choiceIndex as number }
      : null;
  }
  if (i.kind === "code") {
    if (typeof i.code !== "string" || typeof i.passed !== "boolean" || !Array.isArray(i.results)) {
      return null;
    }
    if (i.code.length > MAX_CODE_CHARS || i.results.length > MAX_RESULTS) return null;
    const results: { passed: boolean; output?: string; error?: string }[] = [];
    for (const r of i.results) {
      if (!r || typeof r !== "object" || typeof (r as { passed?: unknown }).passed !== "boolean") {
        return null;
      }
      const { passed, output, error } = r as { passed: boolean; output?: unknown; error?: unknown };
      if (
        (typeof output === "string" && output.length > MAX_RESULT_TEXT) ||
        (typeof error === "string" && error.length > MAX_RESULT_TEXT)
      ) {
        return null;
      }
      results.push({
        passed,
        ...(typeof output === "string" ? { output } : {}),
        ...(typeof error === "string" ? { error } : {}),
      });
    }
    return { kind: "code", code: i.code, passed: i.passed, results };
  }
  return null;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return bad();
  }
  if (!raw || typeof raw !== "object") return bad();
  const b = raw as { type?: unknown; problemId?: unknown; input?: unknown };
  if (!PROBLEM_TYPES.includes(b.type as ProblemType)) return bad();
  if (typeof b.problemId !== "string") return bad();
  const input = parseInput(b.input);
  if (!input) return bad();

  const result = await submit(getDeps(), session.user.id, {
    type: b.type as ProblemType,
    problemId: b.problemId,
    input,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ isCorrect: result.isCorrect, commit: result.commit });
}
