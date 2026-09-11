import type { GuardProvider, TeacherProvider } from "@/domain/ports";

/** Deliberately deterministic. This is a test/demo adapter, not an LLM assessment. */
export class DemoGuard implements GuardProvider {
  async classify(input: string) {
    if (
      /\b(help|example|don't understand|do not understand|explain)\b|不懂|例子|帮助/i.test(
        input,
      )
    )
      return { intent: "help" as const };
    if (
      /\b(write (me )?(code|a program)|bitcoin|system prompt|ignore (all |your )?instructions)\b/i.test(
        input,
      )
    )
      return { intent: "redirect" as const };
    return { intent: "practice" as const };
  }
}
export class DemoTeacher implements TeacherProvider {
  async respond(context: Parameters<TeacherProvider["respond"]>[0]) {
    if (context.intent === "help")
      return {
        text: `Try this: “${context.objective.example}” Now try it in your own words.`,
      };
    if (context.intent === "redirect")
      return {
        text: `Let's bring it back to our English practice. ${context.objective.prompt}`,
      };
    if (context.allObjectivesPracticed)
      return {
        text: "You've tried each part of this conversation. For one more round, put your introduction, a detail, and a question together. You can finish whenever you're ready.",
      };
    const cue =
      context.learner.level === "A1" || context.learner.level === "A2"
        ? "One short sentence is enough."
        : context.learner.level === "C1" || context.learner.level === "C2"
          ? "Try adding a precise detail or a different perspective."
          : "Try adding a little detail.";
    return { text: `${cue} ${context.objective.prompt}` };
  }
}
