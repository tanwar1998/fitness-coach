import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/server/ai/exercise-retrieval", () => ({
  getExerciseIndex: () => [
    {
      id: 5,
      name: "Barbell Back Squat",
      category: "Strength",
      equipment: ["barbell"],
      muscles: ["Quadriceps"],
      description: "A barbell squat.",
      vector: [],
    },
  ],
  buildRetrievalQuery: (query: string) => query,
  retrieveExercises: async () => [],
  formatRetrievedExercises: (exercises: unknown[]) =>
    JSON.stringify(exercises),
}));

import {
  adjustPlanForConstraints,
  answerIsYes,
  canonicalizePlan,
  normalizeEnergy,
  parseTimeMinutes,
  planAssumesMinutes,
  planNeedsAdjustment,
  plansEqual,
  workoutPlanSchema,
} from "./plan";
import type { CoachConstraints } from "@/lib/coach-types";

const basePlan = {
  date: "2026-09-15",
  adjustedReason: null,
  items: [
    { exerciseId: 5, name: "Barbell Back Squat", sets: 3, reps: "8-12", notes: "" },
    { exerciseId: 6, name: "Romanian Deadlift", sets: 3, reps: "10-12", notes: "" },
    { exerciseId: 7, name: "Plank", sets: 3, reps: "30s", notes: "" },
  ],
};

const cleanConstraints: CoachConstraints = {
  energy: "normal",
  painFlag: false,
  painNote: null,
  timeAvailableMin: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parseTimeMinutes", () => {
  it("parses explicit minutes", () => {
    expect(parseTimeMinutes("30 min")).toBe(30);
    expect(parseTimeMinutes("45mins")).toBe(45);
    expect(parseTimeMinutes("about 60 minutes")).toBe(60);
  });

  it("parses hours", () => {
    expect(parseTimeMinutes("1 hour")).toBe(60);
    expect(parseTimeMinutes("1.5 hrs")).toBe(90);
  });

  it("parses halves / bare numbers", () => {
    expect(parseTimeMinutes("half an hour")).toBe(30);
    expect(parseTimeMinutes("25")).toBe(25);
    expect(parseTimeMinutes("15 ")).toBe(15);
  });

  it("returns null for unusable input", () => {
    expect(parseTimeMinutes("no change")).toBe(null);
    expect(parseTimeMinutes("as usual")).toBe(null);
    expect(parseTimeMinutes("")).toBe(null);
    expect(parseTimeMinutes("don't know")).toBe(null);
  });
});

describe("normalizeEnergy", () => {
  it("maps common signals", () => {
    expect(normalizeEnergy("low")).toBe("low");
    expect(normalizeEnergy("I'm exhausted")).toBe("low");
    expect(normalizeEnergy("high")).toBe("high");
    expect(normalizeEnergy("plenty of energy")).toBe("high");
    expect(normalizeEnergy("fine")).toBe("normal");
    expect(normalizeEnergy("as usual")).toBe("normal");
  });
});

describe("answerIsYes", () => {
  it("accepts yes variants and rejects no variants", () => {
    expect(answerIsYes("yes")).toBe(true);
    expect(answerIsYes("yeah knee hurts")).toBe(true);
    expect(answerIsYes("y")).toBe(true);
    expect(answerIsYes("no")).toBe(false);
    expect(answerIsYes("nope")).toBe(false);
  });
});

describe("planAssumesMinutes / planNeedsAdjustment", () => {
  it("assumes ~3 minutes per working set with a 10-minute floor", () => {
    expect(planAssumesMinutes(basePlan)).toBe(27);
    expect(planAssumesMinutes(null)).toBe(0);
    expect(planAssumesMinutes({ ...basePlan, items: [{ ...basePlan.items[0] }] })).toBe(
      10,
    );
  });

  it("ignores a normal check-in", () => {
    expect(planNeedsAdjustment(basePlan, cleanConstraints)).toBe(false);
  });

  it("triggers on low energy, pain, or short time", () => {
    expect(
      planNeedsAdjustment(basePlan, { ...cleanConstraints, energy: "low" }),
    ).toBe(true);
    expect(
      planNeedsAdjustment(basePlan, { ...cleanConstraints, painFlag: true }),
    ).toBe(true);
    expect(
      planNeedsAdjustment(basePlan, { ...cleanConstraints, timeAvailableMin: 20 }),
    ).toBe(true);
    expect(
      planNeedsAdjustment(basePlan, { ...cleanConstraints, timeAvailableMin: 30 }),
    ).toBe(false);
  });
});

describe("plansEqual", () => {
  it("compares structure, ignoring ordering", () => {
    const copy = JSON.parse(JSON.stringify(basePlan));
    expect(plansEqual(basePlan, copy)).toBe(true);
    copy.items[0].sets = 4;
    expect(plansEqual(basePlan, copy)).toBe(false);
    expect(plansEqual(null, basePlan)).toBe(false);
  });
});

describe("adjustPlanForConstraints (deterministic fallback)", () => {
  it("scales volume down for low energy and explains itself", () => {
    const next = adjustPlanForConstraints(basePlan, {
      ...cleanConstraints,
      energy: "low",
    });
    expect(next.adjustedReason).toBeTruthy();
    expect(next.items[0].sets).toBeLessThan(basePlan.items[0].sets);
    expect(workoutPlanSchema.safeParse(next).success).toBe(true);
  });

  it("fits a tight time budget by dropping trailing items", () => {
    const next = adjustPlanForConstraints(basePlan, {
      ...cleanConstraints,
      timeAvailableMin: 15,
    });
    expect(next.adjustedReason).toContain("15 minutes");
    expect(next.items.length).toBeLessThan(basePlan.items.length);
  });

  it("never swaps exercises", () => {
    const next = adjustPlanForConstraints(basePlan, {
      ...cleanConstraints,
      painFlag: true,
      painNote: "knee",
    });
    for (const item of next.items) {
      expect(item.exerciseId).not.toBe(0);
    }
  });
});

describe("canonicalizePlan", () => {
  it("resolves a curated exercise by name to a wger id", () => {
    const plan = canonicalizePlan(
      {
        date: "2026-09-15",
        items: [
          { name: "Barbell Back Squat", sets: "3", reps: "8-12", notes: "pad" },
        ],
      },
      "2026-09-15",
    );
    expect(plan?.items[0].exerciseId).toBe(5);
  });

  it("keeps a numeric id that the client already resolved", () => {
    const plan = canonicalizePlan(
      {
        items: [{ exerciseId: 42, name: "Leg Press", sets: 4, reps: "10-12" }],
      },
      "2026-09-15",
    );
    expect(plan?.items[0].exerciseId).toBe(42);
  });

  it("returns null for unusable payloads", () => {
    expect(canonicalizePlan(null, "2026-09-15")).toBe(null);
    expect(canonicalizePlan({ items: [] }, "2026-09-15")).toBe(null);
    expect(canonicalizePlan({}, "2026-09-15")).toBe(null);
  });
});