import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { classifyIntent } from "./graph-v2";
import { INTENTS, type CoachIntent } from "./intents";
import { AMBIGUOUS_PAIRS, ROUTER_CASES, type RouterCase } from "./router-cases";

/**
 * Router accuracy harness.
 *
 * Default (CI) mode mocks the router model with one that always throws, which
 * exercises the production fallback path (`heuristicIntent`) deterministically —
 * no network, no keys, stable expectations. Set ROUTER_LIVE=1 (with a provider
 * API key in the environment) to classify the same messages with the real
 * router model and measure its accuracy instead.
 *
 * The per-intent table is printed on every run so regressions are visible.
 */

const LIVE = process.env.ROUTER_LIVE === "1";
const LIVE_TIMEOUT_MS = 240_000;

/** Mocked router model: makes classifyIntent take its deterministic fallback. */
const offlineModel = {
  async invoke() {
    throw new Error("router model disabled in mocked mode");
  },
} as never;

function anyProviderConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_GEMINI_KEY ||
      process.env.GROK_API_KEY ||
      process.env.XAI_API_KEY ||
      process.env.DEEPSEEK_API_KEY ||
      process.env.OPENAI_API_KEY,
  );
}

interface ClassifiedCase extends RouterCase {
  actual: CoachIntent;
  confidence: number;
}

const results: ClassifiedCase[] = [];

beforeAll(async () => {
  if (LIVE && !anyProviderConfigured()) {
    throw new Error(
      "ROUTER_LIVE=1 needs at least one provider key (GOOGLE_GEMINI_KEY, GROK_API_KEY, XAI_API_KEY, DEEPSEEK_API_KEY or OPENAI_API_KEY).",
    );
  }

  // Mocked mode intentionally triggers the fallback branch, which logs to
  // console.error; keep the test output readable. Live mode keeps the logs.
  if (!LIVE) {
    vi.spyOn(console, "error").mockImplementation(() => {});
  }

  for (const testCase of ROUTER_CASES) {
    const { intent, confidence } = await classifyIntent(testCase.message, {
      hasPendingAction: testCase.hasPendingAction,
      context: "Test fixture: no user context available.",
      ...(LIVE ? {} : { model: offlineModel }),
    });
    results.push({ ...testCase, actual: intent, confidence });

    // Free-tier providers rate-limit aggressively; pace live runs.
    if (LIVE) {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
    }
  }
}, LIVE ? LIVE_TIMEOUT_MS : 20_000);

afterAll(() => {
  vi.restoreAllMocks();
});

describe("router intent accuracy", () => {
  it("has at least eight messages for every intent", () => {
    for (const intent of INTENTS) {
      const count = ROUTER_CASES.filter((testCase) => testCase.intent === intent)
        .length;
      expect(count, `cases for ${intent}`).toBeGreaterThanOrEqual(8);
    }
  });

  it(`reports accuracy per intent (${LIVE ? "live model" : "mocked model"})`, () => {
    const rows = INTENTS.map((intent) => {
      const cases = results.filter((result) => result.intent === intent);
      const correct = cases.filter((result) => result.actual === intent).length;
      return {
        intent,
        total: cases.length,
        correct,
        accuracy: cases.length === 0 ? 0 : correct / cases.length,
      };
    });

    const overallCorrect = results.filter(
      (result) => result.actual === result.intent,
    ).length;
    const overall = results.length === 0 ? 0 : overallCorrect / results.length;

    const table = rows
      .map(
        (row) =>
          `  ${row.intent.padEnd(24)} ${String(row.correct).padStart(2)}/${String(row.total).padEnd(2)}  ${(row.accuracy * 100).toFixed(1)}%`,
      )
      .join("\n");
    console.info(
      `\nRouter accuracy — ${LIVE ? "live model" : "mocked (deterministic fallback)"}\n${table}\n  ${"overall".padEnd(24)} ${String(overallCorrect).padStart(2)}/${String(results.length).padEnd(2)}  ${(overall * 100).toFixed(1)}%\n`,
    );

    expect(results).toHaveLength(ROUTER_CASES.length);
    // Mocked mode measures the deterministic safety net; live mode allows the
    // usual model variance but must still clear a useful bar.
    expect(overall).toBeGreaterThanOrEqual(LIVE ? 0.7 : 0.8);
  });

  it("handles the ambiguous pairs", () => {
    const predictions = AMBIGUOUS_PAIRS.map((pair) => {
      const first = results.find((result) => result.message === pair.first);
      const second = results.find((result) => result.message === pair.second);
      if (!first || !second) {
        throw new Error(`ambiguous pair missing from dataset: "${pair.first}" / "${pair.second}"`);
      }
      return { pair, first, second };
    });

    const table = predictions
      .map(
        ({ pair, first, second }) =>
          `  "${pair.first}" → ${first.actual}\n  "${pair.second}" → ${second.actual}`,
      )
      .join("\n");
    console.info(`\nAmbiguous pairs\n${table}\n`);

    if (LIVE) {
      for (const { pair, first, second } of predictions) {
        expect(first.actual).toBe(pair.firstIntent);
        expect(second.actual).toBe(pair.secondIntent);
      }
    }
  });
});
