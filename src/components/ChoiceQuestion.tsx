import type { PublicProblem } from "@/lib/problems/schema";

export type ChoiceProblemPublic = Extract<PublicProblem, { type: "ai" | "network" | "claude-code" }>;

export function ChoiceQuestion({
  problem,
  selected,
  onSelect,
  disabled,
  correctIndex,
}: {
  problem: ChoiceProblemPublic;
  selected: number | null;
  onSelect: (i: number) => void;
  disabled: boolean;
  /** Only set after the user pressed "해설 보기". */
  correctIndex: number | null;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">{problem.title}</h1>
        <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">{problem.prompt}</p>
      </div>
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="sr-only">보기</legend>
        {problem.choices.map((text, i) => {
          const isAnswer = correctIndex === i;
          const isWrongPick = correctIndex !== null && selected === i && !isAnswer;
          const border = isAnswer ? "#1A7F37" : isWrongPick ? "#BC4C00" : selected === i ? "#1F2328" : "#D0D7DE";
          return (
            <label
              key={i}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2"
              style={{ borderColor: border, borderWidth: selected === i || isAnswer ? 2 : 1, background: isAnswer ? "#DAFBE1" : "#fff" }}
            >
              <input
                type="radio"
                name="choice"
                checked={selected === i}
                onChange={() => onSelect(i)}
                className="h-5 w-5 shrink-0"
                style={{ accentColor: "#1A7F37" }}
              />
              <span className="min-w-0 flex-1 text-base">{text}</span>
              {isAnswer && (
                <span className="shrink-0 text-xs font-bold" style={{ color: "#116329" }}>
                  정답 보기
                </span>
              )}
            </label>
          );
        })}
      </fieldset>
    </section>
  );
}
