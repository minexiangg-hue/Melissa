import type { Goal, Level } from "@/domain/models";
import type { MaterialDraft, MaterialSeed } from "@/domain/learning/models";

type Phrase = [term: string, meaning: string, example: string];
type Check = [
  prompt: string,
  answer: string,
  wrong: string,
  other: string,
  explanation: string,
];
interface Scene {
  id: string;
  title: string;
  goal: Goal;
  levels: Level[];
  description: string;
  tags: string[];
  focus: string;
  sources?: string[];
  reading: string;
  dialogue: [string, string][];
  phrases: Phrase[];
  checks: Check[];
  prompts: [string, string, string][];
}
export function scene(input: Scene): MaterialSeed {
  const draft: MaterialDraft = {
    title: input.title,
    summary: input.description,
    reading: { title: "A small moment", text: input.reading },
    dialogue: input.dialogue.map(([speaker, text]) => ({ speaker, text })),
    vocabulary: input.phrases.map(([term, meaning, example]) => ({
      term,
      meaning,
      example,
    })),
    exercises: input.checks.map(
      ([prompt, answer, wrong, other, explanation], index) => {
        const options = [wrong, other];
        const answerIndex = index % 3;
        options.splice(answerIndex, 0, answer);
        return {
          id: `check-${index + 1}`,
          prompt,
          options,
          answerIndex,
          explanation,
        };
      },
    ),
    objectives: input.prompts.map(([title, prompt, example], index) => ({
      id: `practice-${index + 1}`,
      title,
      prompt,
      example,
    })),
  };
  return {
    id: input.id,
    title: input.title,
    goal: input.goal,
    levels: input.levels,
    description: input.description,
    topic: input.tags.slice(0, 3).join(", "),
    tags: input.tags,
    focus: input.focus,
    sourceIds: ["melissa-original", ...(input.sources ?? [])],
    draft,
  };
}
