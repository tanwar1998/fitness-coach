import { describe, expect, it, vi, beforeEach } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { MemorySaver, Command } from "@langchain/langgraph";

/**
 * Router accuracy + guardrail tests for the v2 coach graph.
 *
 * The router LLM is replaced with a deterministic stub that emulates a good
 * classifier, so these tests assert the GRAPH's routing/guardrail/confirmation
 * behaviour (which is what we control) without spending tokens or needing keys.
 * A separate set checks the real prompt's intent coverage via the intent list.
 */

// --- model gateway stub -----------------------------------------------------
const structuredResponders: Record<string, (input: unknown) => unknown> = {};

vi.mock("@/ai/models", () => {
  const resolveRoleConfig = (role: string) => ({
    role,
    primary: "gemini",
    model: "stub-model",
    fallbacks: [],
    temperature: 0,
  });

  const makeModel = () => ({
    invoke: async () => {
      const responder = structuredResponders["chat_text"];
      return new AIMessage(responder ? String(responder(undefined)) : "stub reply");
    },
  });

  const makeStructuredModel = (options?: { name?: string }) => {
    const name = options?.name ?? "default";
    return {
      invoke: async (input: unknown) => {
        const responder = structuredResponders[name];
        if (!responder) throw new Error(`No stub for structured output "${name}"`);
        return responder(input);
      },
    };
  };

  return {
    getRoleModel: () => makeModel(),
    getStructuredModel: (_role: unknown, _schema: unknown, options?: { name?: string }) =>
      makeStructuredModel(options),
    invokeModel: async (model: { invoke: (input: unknown) => unknown }, input: unknown) =>
      model.invoke(input),
    resolveRoleConfig,
    logAnsweredModel: () => {},
    isProviderConfigured: () => true,
  };
});

// Context/retrieval/db access is stubbed — these tests are about routing.
vi.mock("@/lib/server/ai/tools", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/ai/tools")>(
    "@/lib/server/ai/tools",
  );
  return {
    ...actual,
    loadUserContext: async () => ({
      userId: "test-device",
      goals: [],
      stats: { streak: 0, workoutsCompleted: 0, weeklyDaysThisWeek: 0, heatmapDays: [] },
      nutrition: null,
      injuries: [],
      lastWorkout: null,
      loggedToday: false,
      summaryText: "No goals yet.",
    }),
    progressGoalsTool: async () => ({
      stats: { streak: 0, workoutsCompleted: 0, weeklyDaysThisWeek: 0, heatmapDays: [] },
      goals: [],
      recentWorkouts: [],
    }),
    nutritionTool: async () => ({
      today: { date: "2026-01-01", entries: [], summary: { kcal: 0, protein: 0, carbs: 0, fat: 0 } },
      targets: { kcal: 2000, proteinG: 120, carbsG: 250, fatG: 70 },
    }),
    logWorkoutTool: vi.fn(async () => ({
      log: {
        id: "log_test",
        workoutId: "w1",
        goal: "strength",
        level: "intermediate",
        durationMinutes: 30,
        preset: "full",
        exerciseCount: 2,
        completedAt: new Date().toISOString(),
        undoable: true,
        updatedGoals: [{ goalId: "g1", goalName: "Squat volume" }],
      },
      goalUpdates: [
        {
          goalId: "g1",
          goalName: "Squat volume",
          unit: "sets",
          status: "updated" as const,
          value: 7,
          reason: "Workout included 2 strength lifts (7 total sets).",
        },
      ],
      stats: { streak: 1, workoutsCompleted: 1, weeklyDaysThisWeek: 1, heatmapDays: [] },
    })),
    undoWorkoutTool: vi.fn(async () => ({
      ok: true as const,
      stats: { streak: 0, workoutsCompleted: 0, weeklyDaysThisWeek: 0, heatmapDays: [] },
      goals: [{ id: "g1", progress: 0, status: "active" }],
    })),
  };
});

import { buildCoachGraphV2, heuristicIntent } from "@/lib/server/ai/graph-v2";
import { workoutActionSchema, guardrailSchema } from "@/lib/server/ai/intents";
import * as tools from "@/lib/server/ai/tools";

const config = (threadId: string) => ({ configurable: { thread_id: threadId } });

function routerSays(intent: string, confidence = 0.9) {
  structuredResponders["classify_intent"] = () => ({ intent, confidence, reasoning: "stub" });
}

function workoutActionSays(action: unknown) {
  structuredResponders["workout_action"] = () => workoutActionSchema.parse(action);
}

function guardrailSays(verdict: "safe" | "soften" | "block", category = "none") {
  structuredResponders["guardrail"] = () =>
    guardrailSchema.parse({ verdict, category, note: verdict === "soften" ? "Keep it gentle." : "" });
}

async function finalState(graph: ReturnType<typeof buildCoachGraphV2>, threadId: string) {
  return (await graph.getState(config(threadId))).values as Record<string, unknown>;
}

beforeEach(() => {
  structuredResponders["classify_intent"] = () => ({
    intent: "general_chat",
    confidence: 0.9,
    reasoning: "default",
  });
  structuredResponders["workout_action"] = () => ({ action: "none" });
  structuredResponders["guardrail"] = () =>
    guardrailSchema.parse({ verdict: "safe", category: "none", note: "" });
  delete structuredResponders["chat_text"];
  vi.mocked(tools.logWorkoutTool).mockClear();
  vi.mocked(tools.undoWorkoutTool).mockClear();
});

describe("v2 router", () => {
  const cases: { message: string; intent: string }[] = [
    { message: "build me a 30 minute leg workout", intent: "generate_workout" },
    { message: "I finished my workout, log it", intent: "log_or_edit_workout" },
    { message: "how is my streak doing?", intent: "progress_goals" },
    { message: "how much protein should I eat?", intent: "nutrition_qa" },
    { message: "what's good form for a deadlift?", intent: "general_chat" },
  ];

  for (const testCase of cases) {
    it(`routes to ${testCase.intent}`, async () => {
      routerSays(testCase.intent);
      const graph = buildCoachGraphV2(new MemorySaver());
      const threadId = `router-${testCase.intent}`;

      await graph.invoke(
        { messages: [new HumanMessage(testCase.message)], userId: "test-device" },
        config(threadId),
      );

      const state = await finalState(graph, threadId);
      expect(state.intent).toBe(testCase.intent);
    });
  }

  it("falls back to general_chat when the router is unsure", async () => {
    routerSays("log_or_edit_workout", 0.1);
    const graph = buildCoachGraphV2(new MemorySaver());
    const threadId = "router-low-confidence";

    await graph.invoke(
      { messages: [new HumanMessage("hmm not sure")], userId: "test-device" },
      config(threadId),
    );

    const state = await finalState(graph, threadId);
    expect(state.intent).toBe("general_chat");
  });
});

describe("router failure fallback", () => {
  it("still finds write intents when the router model times out", () => {
    expect(heuristicIntent("I just finished my workout, please log it")).toBe(
      "log_or_edit_workout",
    );
    expect(heuristicIntent("undo my last workout")).toBe("log_or_edit_workout");
    expect(heuristicIntent("build me a new routine")).toBe("generate_workout");
    expect(heuristicIntent("how much protein should I eat?")).toBe("nutrition_qa");
    expect(heuristicIntent("what's my streak?")).toBe("progress_goals");
    expect(heuristicIntent("what's good form for a squat?")).toBe("general_chat");
  });
});

describe("v2 write intents require confirmation", () => {
  it("pauses before logging and writes only after the user confirms", async () => {
    routerSays("log_or_edit_workout");
    workoutActionSays({
      action: "log_workout",
      goal: "strength",
      level: "intermediate",
      durationMinutes: 30,
      preset: "full",
      exercises: [{ name: "Back Squat", sets: 4 }],
    });
    guardrailSays("safe");

    const graph = buildCoachGraphV2(new MemorySaver());
    const threadId = "confirm-log";

    await graph.invoke(
      { messages: [new HumanMessage("I finished my squat session")], userId: "test-device" },
      config(threadId),
    );

    // Paused: nothing written yet.
    const paused = await graph.getState(config(threadId));
    expect(paused.next.length).toBeGreaterThan(0);
    expect(tools.logWorkoutTool).not.toHaveBeenCalled();

    await graph.invoke(new Command({ resume: "Yes, do it" }), config(threadId));

    expect(tools.logWorkoutTool).toHaveBeenCalledTimes(1);
    const state = await finalState(graph, threadId);
    expect(String(state.output)).toContain("Squat volume");
  });

  it("cancels cleanly when the user declines", async () => {
    routerSays("log_or_edit_workout");
    workoutActionSays({ action: "undo_workout" });
    guardrailSays("safe");

    const graph = buildCoachGraphV2(new MemorySaver());
    const threadId = "confirm-decline";

    await graph.invoke(
      { messages: [new HumanMessage("undo my last workout")], userId: "test-device" },
      config(threadId),
    );
    await graph.invoke(new Command({ resume: "No, cancel" }), config(threadId));

    expect(tools.undoWorkoutTool).not.toHaveBeenCalled();
    const state = await finalState(graph, threadId);
    expect(String(state.output)).toMatch(/haven't changed anything/i);
  });
});

describe("v2 generate_workout", () => {
  it("does not leave a phantom pending action behind", async () => {
    routerSays("generate_workout");
    guardrailSays("safe");

    const graph = buildCoachGraphV2(new MemorySaver());
    const threadId = "generate-then-chat";

    await graph.invoke(
      { messages: [new HumanMessage("build me a 30 minute workout")], userId: "test-device" },
      config(threadId),
    );

    const afterGenerate = await finalState(graph, threadId);
    expect(afterGenerate.pendingAction).toBeNull();

    // A later unrelated message must route normally, not into the
    // "nothing waiting for confirmation" dead end.
    routerSays("general_chat");
    await graph.invoke(
      { messages: [new HumanMessage("what's good form for a squat?")], userId: "test-device" },
      config(threadId),
    );

    const afterChat = await finalState(graph, threadId);
    expect(afterChat.intent).toBe("general_chat");
  });
});

describe("v2 chat replies", () => {
  it("unwraps the legacy JSON envelope instead of showing raw JSON to the user", async () => {
    routerSays("general_chat");
    structuredResponders["chat_text"] = () =>
      JSON.stringify({
        reply: "Keep your back flat and brace before you pull.",
        referenced_exercise_ids: [],
        action: "finish",
      });

    const graph = buildCoachGraphV2(new MemorySaver());
    const threadId = "chat-json-envelope";

    await graph.invoke(
      { messages: [new HumanMessage("what's good form for a deadlift?")], userId: "test-device" },
      config(threadId),
    );

    const state = await finalState(graph, threadId);
    expect(state.output).toBe("Keep your back flat and brace before you pull.");
    expect(state.answerAction).toBe("finish");
  });

  it("keeps plain markdown replies untouched", async () => {
    routerSays("general_chat");
    structuredResponders["chat_text"] = () => "Aim for 3 sets of 8 reps.";

    const graph = buildCoachGraphV2(new MemorySaver());
    const threadId = "chat-plain-text";

    await graph.invoke(
      { messages: [new HumanMessage("how many sets?")], userId: "test-device" },
      config(threadId),
    );

    const state = await finalState(graph, threadId);
    expect(state.output).toBe("Aim for 3 sets of 8 reps.");
  });

  it("clears a previous question when a later turn answers directly", async () => {
    routerSays("general_chat");
    structuredResponders["chat_text"] = () =>
      JSON.stringify({
        reply: "Do you train at home or at a gym?",
        referenced_exercise_ids: [],
        action: "ask_options",
        options: ["Home", "Gym"],
      });

    const graph = buildCoachGraphV2(new MemorySaver());
    const threadId = "chat-action-reset";

    await graph.invoke(
      { messages: [new HumanMessage("help me pick a routine")], userId: "test-device" },
      config(threadId),
    );
    let state = await finalState(graph, threadId);
    expect(state.answerAction).toBe("ask_options");
    expect(state.answerOptions).toEqual(["Home", "Gym"]);

    structuredResponders["chat_text"] = () => "Great — start with two full-body days.";
    await graph.invoke(
      { messages: [new HumanMessage("Gym")], userId: "test-device" },
      config(threadId),
    );
    state = await finalState(graph, threadId);
    expect(state.answerAction).toBe("finish");
    expect(state.answerOptions).toEqual([]);
  });
});

describe("v2 guardrail", () => {
  it("blocks unsafe advice and flags a human hand-off", async () => {
    routerSays("nutrition_qa");
    guardrailSays("block", "extreme_diet");

    const graph = buildCoachGraphV2(new MemorySaver());
    const threadId = "guardrail-block";

    await graph.invoke(
      { messages: [new HumanMessage("how do I eat 600 calories a day")], userId: "test-device" },
      config(threadId),
    );

    const state = await finalState(graph, threadId);
    expect(state.requiresHuman).toBe(true);
    expect(String(state.output)).toMatch(/qualified professional/i);
  });

  it("keeps the answer but adds limits when softening", async () => {
    routerSays("general_chat");
    guardrailSays("soften", "injury");

    const graph = buildCoachGraphV2(new MemorySaver());
    const threadId = "guardrail-soften";

    await graph.invoke(
      { messages: [new HumanMessage("my knee aches, what should I do")], userId: "test-device" },
      config(threadId),
    );

    const state = await finalState(graph, threadId);
    expect(state.requiresHuman).toBe(false);
    expect(String(state.output)).toContain("Keep it gentle.");
  });
});
