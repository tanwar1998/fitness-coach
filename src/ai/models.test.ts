import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AIMessage } from "@langchain/core/messages";

/**
 * Model-gateway fallback tests.
 *
 * These mock the provider packages (no network, no keys) and assert that
 *  - the gateway builds a primary + ordered fallbacks per role from env vars
 *  - a failing primary transparently rolls over to the next provider
 *  - an outage on every provider surfaces as an error (no silent empty answer)
 *  - which provider answered is logged
 */

const invoked: { provider: string; model: string }[] = [];
const failingProviders = new Set<string>();

function callProvider(provider: string, model: string): string {
  invoked.push({ provider, model });
  if (failingProviders.has(provider)) {
    throw new Error(`${provider} is down (429 rate limited)`);
  }
  return `answer from ${provider}`;
}

interface Invokable {
  invoke: () => Promise<unknown>;
}

function runWithFallbacks(chain: Invokable[]) {
  return {
    invoke: async () => {
      let lastError: unknown;
      for (const model of chain) {
        try {
          return await model.invoke();
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError;
    },
  };
}

function makeStructuredModel(provider: string, model: string) {
  return {
    invoke: async () => ({ answer: callProvider(provider, model) }),
    withFallbacks: ({ fallbacks }: { fallbacks: Invokable[] }) =>
      runWithFallbacks([{ invoke: async () => ({ answer: callProvider(provider, model) }) }, ...fallbacks]),
  };
}

function makeFakeModel(provider: string, model: string) {
  const invoke = async () => new AIMessage(callProvider(provider, model));
  return {
    _provider: provider,
    _model: model,
    invoke,
    withStructuredOutput: () => makeStructuredModel(provider, model),
    withFallbacks: ({ fallbacks }: { fallbacks: Invokable[] }) =>
      runWithFallbacks([{ invoke }, ...fallbacks]),
  };
}

type FakeModel = ReturnType<typeof makeFakeModel>;

/** Attach withFallbacks() to a fake model without relying on `this`. */
function withFallbacksOn(model: FakeModel) {
  return model;
}

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: class {
    /** ChatOpenAI backs both OpenAI and DeepSeek; the baseURL tells them apart. */
    constructor(fields: { model: string; configuration?: { baseURL?: string } }) {
      const isDeepSeek = Boolean(fields.configuration?.baseURL?.includes("deepseek"));
      return withFallbacksOn(
        makeFakeModel(isDeepSeek ? "deepseek" : "openai", fields.model),
      ) as never;
    }
  },
}));

vi.mock("@langchain/xai", () => ({
  ChatXAI: class {
    constructor(fields: { model: string }) {
      return withFallbacksOn(makeFakeModel("xai", fields.model)) as never;
    }
  },
}));

vi.mock("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: class {
    constructor(fields: { model: string }) {
      return withFallbacksOn(makeFakeModel("gemini", fields.model)) as never;
    }
  },
}));

const ENV_KEYS = [
  "AI_PROVIDER",
  "AI_CHAT_PROVIDER",
  "AI_CHAT_MODEL",
  "AI_ROUTER_PROVIDER",
  "AI_PLANNER_PROVIDER",
  "AI_MODEL_FALLBACKS",
  "GOOGLE_GEMINI_KEY",
  "OPENAI_API_KEY",
  "GROK_API_KEY",
  "XAI_API_KEY",
  "DEEPSEEK_API_KEY",
];

const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  invoked.length = 0;
  failingProviders.clear();
  for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  for (const key of ENV_KEYS) delete process.env[key];
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  vi.restoreAllMocks();
});

async function loadGateway() {
  vi.resetModules();
  return import("@/ai/models");
}

describe("model gateway", () => {
  it("falls back to the next provider when the primary is rate limited", async () => {
    process.env.GOOGLE_GEMINI_KEY = "test-gemini";
    process.env.DEEPSEEK_API_KEY = "test-deepseek";
    process.env.AI_CHAT_PROVIDER = "gemini";
    process.env.AI_MODEL_FALLBACKS = "gemini,deepseek";

    const { getRoleModel } = await loadGateway();

    failingProviders.add("gemini");
    const model = getRoleModel("chat") as unknown as { invoke: (i: unknown) => Promise<AIMessage> };

    const reply = await model.invoke("hello");

    expect(reply.content).toBe("answer from deepseek");
    // Proves the fallback actually engaged rather than the primary answering.
    expect(invoked.map((i) => i.provider)).toEqual(["gemini", "deepseek"]);
  });

  it("keeps the fallback chain for structured output", async () => {
    process.env.GOOGLE_GEMINI_KEY = "test-gemini";
    process.env.DEEPSEEK_API_KEY = "test-deepseek";
    process.env.AI_ROUTER_PROVIDER = "gemini";
    process.env.AI_MODEL_FALLBACKS = "gemini,deepseek";

    const { getStructuredModel } = await loadGateway();

    failingProviders.add("gemini");
    const model = getStructuredModel("router", {} as never, { name: "classify" }) as unknown as {
      invoke: (input: unknown) => Promise<{ answer: string }>;
    };

    const result = await model.invoke("classify this");

    expect(result.answer).toBe("answer from deepseek");
    expect(invoked.map((i) => i.provider)).toEqual(["gemini", "deepseek"]);
  });

  it("uses the primary when it is healthy", async () => {
    process.env.GOOGLE_GEMINI_KEY = "test-gemini";
    process.env.DEEPSEEK_API_KEY = "test-deepseek";
    process.env.AI_CHAT_PROVIDER = "gemini";
    process.env.AI_MODEL_FALLBACKS = "gemini,deepseek";

    const { getRoleModel } = await loadGateway();
    const model = getRoleModel("chat") as unknown as { invoke: (i: unknown) => Promise<AIMessage> };

    const reply = await model.invoke("hello");

    expect(reply.content).toBe("answer from gemini");
    expect(invoked).toHaveLength(1);
  });

  it("propagates an error when every provider is down", async () => {
    process.env.GOOGLE_GEMINI_KEY = "test-gemini";
    process.env.DEEPSEEK_API_KEY = "test-deepseek";
    process.env.AI_CHAT_PROVIDER = "gemini";
    process.env.AI_MODEL_FALLBACKS = "gemini,deepseek";

    const { getRoleModel } = await loadGateway();
    failingProviders.add("gemini");
    failingProviders.add("deepseek");

    const model = getRoleModel("chat") as unknown as { invoke: (i: unknown) => Promise<AIMessage> };

    await expect(model.invoke("hello")).rejects.toThrow(/down|rate limited/);
    expect(invoked.map((i) => i.provider)).toEqual(["gemini", "deepseek"]);
  });

  it("skips providers that have no API key configured", async () => {
    // Only DeepSeek has a key, but Gemini is requested first.
    process.env.DEEPSEEK_API_KEY = "test-deepseek";
    process.env.AI_CHAT_PROVIDER = "gemini";
    process.env.AI_MODEL_FALLBACKS = "gemini,deepseek";

    const { getRoleModel, resolveRoleConfig } = await loadGateway();

    const config = resolveRoleConfig("chat");
    expect(config.primary).toBe("deepseek");
    expect(config.fallbacks).toEqual([]);

    const model = getRoleModel("chat") as unknown as { invoke: (i: unknown) => Promise<AIMessage> };
    await model.invoke("hello");
    expect(invoked[0].provider).toBe("deepseek");
  });

  it("resolves each role from its own env vars", async () => {
    process.env.GOOGLE_GEMINI_KEY = "test-gemini";
    process.env.GROK_API_KEY = "test-xai";
    process.env.AI_ROUTER_PROVIDER = "gemini";
    process.env.AI_CHAT_PROVIDER = "xai";
    process.env.AI_CHAT_MODEL = "grok-custom";
    process.env.AI_MODEL_FALLBACKS = "gemini,xai";

    const { resolveRoleConfig } = await loadGateway();

    expect(resolveRoleConfig("router").primary).toBe("gemini");
    expect(resolveRoleConfig("chat").primary).toBe("xai");
    expect(resolveRoleConfig("chat").model).toBe("grok-custom");
  });

  it("logs which provider answered", async () => {
    process.env.GOOGLE_GEMINI_KEY = "test-gemini";
    const { logAnsweredModel } = await loadGateway();

    logAnsweredModel("router", "gemini", "gemini-2.0-flash", { intent: "nutrition_qa" });

    expect(console.info).toHaveBeenCalledOnce();
    const payload = JSON.parse(vi.mocked(console.info).mock.calls[0][0] as string);
    expect(payload).toMatchObject({
      role: "router",
      provider: "gemini",
      model: "gemini-2.0-flash",
      intent: "nutrition_qa",
    });
  });
});
