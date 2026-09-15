import { describe, expect, it, beforeEach, vi } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { Command, MemorySaver } from "@langchain/langgraph";
import { buildCoachGraph, registerCoachModel } from "./graph";
import { canonicalizePlan, plansEqual } from "./plan";
import type { CoachConstraints, WorkoutPlan } from "@/lib/coach-types";

// Real retrieval needs an embedding key + a persisted index, so the graph tests
// stub the retrieval module and drive the whole flow through the check-in
// interrupts with a deterministic stand-in model.
let mockAlternatives: { id: number; name: string; category: string }[];
let mockReplanResponse: string;
let mockCoachResponse: string;

vi.mock("@/lib/server/ai/exercise-retrieval", () => ({
  getExerciseIndex: () => [],
  buildRetrievalQuery: (query: string) => query,
  retrieveExercises: async () => mockAlternatives,
  formatRetrievedExercises: (exercises: { length: number }) =>
    String(exercises.length),
}));

const seedPlan: WorkoutPlan =
  canonicalizePlan(
    {
      date: "2026-09-15",
      items: [
        { exerciseId: 1, name: "Barbell Back Squat", sets: 3, reps: "8-12" },
        { exerciseId: 2, name: "Romanian Deadlift", sets: 3, reps: "10-12" },
        { exerciseId: 3, name: "Plank", sets: 3, reps: "30s" },
      ],
    },
    "2026-09-15",
  ) ?? {
    date: "2026-09-15",
    adjustedReason: null,
    items: [
      { exerciseId: 1, name: "Barbell Back Squat", sets: 3, reps: "8-12", notes: "" },
    ],
  };

const cleanConstraints: CoachConstraints = {
  energy: "normal",
  painFlag: false,
  painNote: null,
  timeAvailableMin: null,
};

function makeInput(plan: WorkoutPlan | null) {
  return {
    messages: [new HumanMessage("I'm ready to train.")],
    providerId: "test-provider",
    profile: null,
    currentPlan: plan,
    constraints: cleanConstraints,
  };
}

function threadConfig(threadId: string) {
  return { configurable: { thread_id: threadId } };
}

type CompiledGraph = ReturnType<typeof buildCoachGraph>;

async function pendingQuestion(
  graph: CompiledGraph,
  threadId: string,
): Promise<{ action: string; question: string; options: string[] } | null> {
  const state = await graph.getState(threadConfig(threadId));
  const tasks = (state?.tasks ?? []) as {
    interrupts?: { value?: unknown }[];
  }[];
  const value = tasks[0]?.interrupts?.[0]?.value as
    | { action?: string; question?: string; options?: string[] }
    | undefined;
  if (!value || typeof value.question !== "string") return null;
  return {
    action: value.action ?? "ask_question",
    question: value.question,
    options: Array.isArray(value.options) ? value.options : [],
  };
}

beforeEach(() => {
  mockAlternatives = [
    { id: 510, name: "Leg Press", category: "Machine" },
    { id: 511, name: "Seated Leg Curl", category: "Machine" },
  ];
  mockReplanResponse = "";
  mockCoachResponse = "";
});

// Deterministic stand-in for the provider adapters. Replan calls are told apart
// from coach calls by the plan-adjustment prompt they receive.
registerCoachModel((providerId) => {
  if (providerId !== "test-provider") {
    throw new Error(`Unexpected provider ${providerId}`);
  }
  return {
    displayName: "test-model",
    invoke: async (messages) => {
      const text = messages
        .map((message) =>
          typeof message.content === "string"
            ? message.content
            : String(message.content),
        )
        .join("\n");
      if (text.includes("plan-adjustment step")) return mockReplanResponse;
      return mockCoachResponse;
    },
  };
});

function fenced(json: unknown): string {
  return `\`\`\`json\n${JSON.stringify(json)}\n\`\`\``;
}

const coachFinish = fenced({
  reply: "All set — happy training!",
  referenced_exercise_ids: [],
  action: "finish",
});

// Run the full daily check-in (energy → pain → [pain note] → time) and return
// the graph state once the conversation completes.
async function runCheckinAndFinish(
  threadId: string,
  answers: string[],
  plan: WorkoutPlan | null,
): Promise<Awaited<ReturnType<CompiledGraph["getState"]>>> {
  const graph = buildCoachGraph(new MemorySaver());
  const config = threadConfig(threadId);
  await graph.invoke(makeInput(plan), config);
  for (const answer of answers) {
    await graph.invoke(new Command({ resume: answer }), config);
  }
  return graph.getState(config);
}

describe("coach graph integration (interrupt loop)", () => {
  it("runs the check-in and leaves the plan alone on a clean bill of health", async () => {
    mockCoachResponse = coachFinish;
    const graph = buildCoachGraph(new MemorySaver());
    const config = threadConfig("t-normal");

    await graph.invoke(makeInput(seedPlan), config);
    expect((await pendingQuestion(graph, "t-normal"))?.question).toContain("energy");

    await graph.invoke(new Command({ resume: "normal" }), config);
    expect((await pendingQuestion(graph, "t-normal"))?.question).toContain("hurt");

    await graph.invoke(new Command({ resume: "no" }), config);
    expect((await pendingQuestion(graph, "t-normal"))?.question).toContain("time");

    await graph.invoke(new Command({ resume: "30 min" }), config);

    const finalState = await graph.getState(config);
    const plan = finalState.values.currentPlan as WorkoutPlan | null;
    expect(finalState.next).toEqual([]);
    expect(plansEqual(seedPlan, plan)).toBe(true);
    expect(plan?.adjustedReason).toBe(null);
    expect(finalState.values.output).toBe("All set — happy training!");
  });

  it("adjusts the plan when energy is low (model returns a valid revised plan)", async () => {
    mockReplanResponse = fenced({
      date: seedPlan.date,
      items: [
        { exerciseId: 1, name: "Barbell Back Squat", sets: 2, reps: "8-12", notes: "lighter" },
        { exerciseId: 2, name: "Romanian Deadlift", sets: 2, reps: "10-12", notes: "lighter" },
        { exerciseId: 3, name: "Plank", sets: 2, reps: "30s", notes: "lighter" },
      ],
      adjustedReason: "Lowered the volume — today's energy is low.",
    });
    mockCoachResponse = coachFinish;

    const finalState = await runCheckinAndFinish(
      "t-low",
      ["low", "no", "as usual"],
      seedPlan,
    );
    const plan = finalState.values.currentPlan as WorkoutPlan | null;

    expect(finalState.next).toEqual([]);
    expect(plan?.adjustedReason).toContain("low");
    expect(plan?.items[0].sets).toBeLessThan(seedPlan.items[0].sets);
    expect(plansEqual(seedPlan, plan)).toBe(false);
    expect(finalState.values.output).toBe("All set — happy training!");
  });

  it("swaps the offending exercise for a retrieved alternative on pain", async () => {
    mockReplanResponse = fenced({
      date: seedPlan.date,
      items: [
        { exerciseId: 510, name: "Leg Press", sets: 3, reps: "10-12", notes: "low impact" },
        { exerciseId: 2, name: "Romanian Deadlift", sets: 3, reps: "10-12", notes: "" },
        { exerciseId: 3, name: "Plank", sets: 3, reps: "30s", notes: "" },
      ],
      adjustedReason: "Swapped back squat for leg press — you flagged knee soreness.",
    });
    mockCoachResponse = coachFinish;

    const graph = buildCoachGraph(new MemorySaver());
    const config = threadConfig("t-pain");
    await graph.invoke(makeInput(seedPlan), config);
    await graph.invoke(new Command({ resume: "normal" }), config);
    await graph.invoke(new Command({ resume: "yes" }), config);
    expect((await pendingQuestion(graph, "t-pain"))?.question).toContain("Where");
    await graph.invoke(new Command({ resume: "My knee hurts when squatting." }), config);
    await graph.invoke(new Command({ resume: "as usual" }), config);

    const finalState = await graph.getState(config);
    const plan = finalState.values.currentPlan as WorkoutPlan | null;

    expect(finalState.next).toEqual([]);
    const names = plan?.items.map((item) => item.name) ?? [];
    expect(names).toContain("Leg Press");
    expect(names).not.toContain("Barbell Back Squat");
    expect(plan?.adjustedReason).toContain("Swapped");
  });

  it("falls back to deterministic scaling when the replan output is unusable", async () => {
    mockReplanResponse = "I don't know what you're asking for.";
    mockCoachResponse = coachFinish;

    const finalState = await runCheckinAndFinish(
      "t-fallback",
      ["extremely low", "no", "20 min"],
      seedPlan,
    );
    const plan = finalState.values.currentPlan as WorkoutPlan | null;

    expect(finalState.next).toEqual([]);
    expect(plan?.adjustedReason).toBeTruthy();
    expect(plan?.items[0].sets).toBeLessThan(seedPlan.items[0].sets);
    expect(plan?.items.length).toBeLessThanOrEqual(seedPlan.items.length);
    expect(finalState.values.output).toBe("All set — happy training!");
  });
});