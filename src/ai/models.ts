import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import type { Runnable } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { ChatXAI } from "@langchain/xai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AiProviderError } from "@/lib/server/ai/types";

/**
 * Model gateway for the AI coach.
 *
 * Models are selected BY ROLE (router / planner / chat), never by hardcoding a
 * provider at the call site. Each role has a primary provider+model plus an
 * ordered fallback chain, both configured through env vars, and every role is
 * wrapped with `.withFallbacks()` so an outage or a rate limit on the primary
 * provider transparently rolls over to the next one.
 *
 * Which provider actually answered is logged on every call (`logAnsweredModel`),
 * so a silent fallback is always visible in the server logs.
 *
 * Configuration (all optional, sensible defaults):
 *   AI_ROUTER_PROVIDER / AI_ROUTER_MODEL   fast + cheap, for intent classification
 *   AI_PLANNER_PROVIDER / AI_PLANNER_MODEL plan generation + targeted edits
 *   AI_CHAT_PROVIDER   / AI_CHAT_MODEL     main conversational coach
 *   AI_MODEL_FALLBACKS                     comma-separated provider order
 *                                          (default: "gemini,deepseek,xai")
 *   AI_REQUEST_TIMEOUT_MS                  hard per-call timeout (default 60000)
 *
 * Provider names: gemini | openai | xai | deepseek
 */

export type ModelProvider = "gemini" | "openai" | "xai" | "deepseek";
export type ModelRole = "router" | "planner" | "chat";

export const MODEL_PROVIDERS: ModelProvider[] = [
  "gemini",
  "openai",
  "xai",
  "deepseek",
];

export const MODEL_ROLES: ModelRole[] = ["router", "planner", "chat"];

interface ProviderEnv {
  apiKey: string | undefined;
  /** Default model for this provider when a role does not override it. */
  defaultModel: string;
  /** Optional custom base URL (OpenAI-compatible providers). */
  baseUrl?: string;
}

/** Read provider credentials/models from the environment (no hardcoded keys). */
function providerEnv(provider: ModelProvider): ProviderEnv {
  switch (provider) {
    case "gemini":
      return {
        apiKey: process.env.GOOGLE_GEMINI_KEY,
        defaultModel: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
      };
    case "openai":
      return {
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        baseUrl: process.env.OPENAI_BASE_URL,
      };
    case "xai":
      return {
        apiKey: process.env.GROK_API_KEY ?? process.env.XAI_API_KEY,
        defaultModel: process.env.GROK_MODEL ?? "grok-4",
        baseUrl: process.env.GROK_BASE_URL ?? "https://api.x.ai/v1",
      };
    case "deepseek":
      return {
        apiKey: process.env.DEEPSEEK_API_KEY,
        defaultModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
        baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
      };
  }
}

export function isProviderConfigured(provider: ModelProvider): boolean {
  return Boolean(providerEnv(provider).apiKey);
}

/** Hard cap on a single model call so a stalled provider cannot hang a request. */
export function modelRequestTimeoutMs(): number {
  const configured = Number(process.env.AI_REQUEST_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 60_000;
}

function buildChatModel(
  provider: ModelProvider,
  model: string,
  temperature: number,
): BaseChatModel {
  const env = providerEnv(provider);
  // isProviderConfigured() is checked by the callers before this point.
  const apiKey = env.apiKey as string;
  // One retry at the provider layer; the fallback chain handles the rest.
  const maxRetries = 1;
  const timeout = modelRequestTimeoutMs();

  switch (provider) {
    case "gemini":
      return new ChatGoogleGenerativeAI({
        model,
        apiKey,
        temperature,
        maxRetries,
      });
    case "xai":
      return new ChatXAI({
        model,
        apiKey,
        temperature,
        maxRetries,
        ...(env.baseUrl ? { baseURL: env.baseUrl } : {}),
      });
    case "openai":
    case "deepseek":
      return new ChatOpenAI({
        model,
        apiKey,
        temperature,
        maxRetries,
        timeout,
        ...(env.baseUrl ? { configuration: { baseURL: env.baseUrl } } : {}),
      });
  }
}

/** Per-role configuration resolved from the environment. */
export interface RoleConfig {
  role: ModelRole;
  /** Provider requested for this role (first choice). */
  primary: ModelProvider;
  /** Model id to use on the primary provider. */
  model: string;
  /** Ordered providers to try after the primary fails. */
  fallbacks: ModelProvider[];
  temperature: number;
}

const ROLE_DEFAULTS: Record<ModelRole, { model: string; temperature: number }> = {
  // Cheap + fast: intent classification only. Low temperature for stability.
  router: { model: "gemini-3.5-flash-lite", temperature: 0 },
  // Structured plan work.
  planner: { model: "gemini-3.5-flash-lite", temperature: 0.2 },
  // The conversational coach.
  chat: { model: "gemini-3.5-flash-lite", temperature: 0.7 },
};

function parseProvider(value: string | undefined): ModelProvider | null {
  const raw = value?.trim().toLowerCase();
  if (!raw) return null;
  return (MODEL_PROVIDERS as string[]).includes(raw)
    ? (raw as ModelProvider)
    : null;
}

/**
 * Default provider order when neither the role nor AI_MODEL_FALLBACKS says
 * otherwise. Mirrors this deployment's reality: Gemini is the only provider
 * with a key today, DeepSeek is the secondary chat brain.
 */
function defaultProviderOrder(): ModelProvider[] {
  return ["gemini", "deepseek", "xai"].filter(
    (provider): provider is ModelProvider =>
      (MODEL_PROVIDERS as string[]).includes(provider),
  );
}

/**
 * Resolve the configuration for a role. The requested provider is honoured when
 * it is configured; otherwise the first configured provider in the fallback
 * order takes its place (so the app keeps working with only one key set).
 */
export function resolveRoleConfig(role: ModelRole): RoleConfig {
  const defaults = ROLE_DEFAULTS[role];
  const requested =
    parseProvider(process.env[`AI_${role.toUpperCase()}_PROVIDER`]) ??
    parseProvider(process.env.AI_PROVIDER);

  const modelOverride = process.env[`AI_${role.toUpperCase()}_MODEL`]?.trim();

  const configuredOrder = (process.env.AI_MODEL_FALLBACKS ?? "")
    .split(",")
    .map((entry) => parseProvider(entry))
    .filter((entry): entry is ModelProvider => entry != null);

  const order = configuredOrder.length > 0 ? configuredOrder : defaultProviderOrder();

  const preferred = requested ?? order[0] ?? "gemini";
  const usable = [preferred, ...order].filter(isProviderConfigured);

  const primary = usable[0] ?? preferred;
  const fallbacks = [...new Set(usable)].filter((p) => p !== primary);

  return {
    role,
    primary,
    model: modelOverride || providerEnv(primary).defaultModel || defaults.model,
    fallbacks,
    temperature: defaults.temperature,
  };
}

/**
 * Build a role's model with its fallback chain attached.
 * Returns a Runnable so callers can use invoke() or withStructuredOutput().
 */
export function getRoleModel(
  role: ModelRole,
): Runnable<unknown, unknown> | BaseChatModel {
  const config = resolveRoleConfig(role);
  const primary = buildChatModel(config.primary, config.model, config.temperature);

  if (config.fallbacks.length === 0) {
    return primary;
  }

  const fallbacks = config.fallbacks.map((provider) =>
    buildChatModel(
      provider,
      providerEnv(provider).defaultModel,
      config.temperature,
    ),
  );

  return primary.withFallbacks({ fallbacks });
}

type StructuredOutputSchema = Parameters<BaseChatModel["withStructuredOutput"]>[0];
type StructuredOutputOptions = Parameters<BaseChatModel["withStructuredOutput"]>[1];

/**
 * A role's model with structured output enabled AND the fallback chain intact.
 *
 * Building the structured runnable before attaching fallbacks matters: the
 * object returned by `.withFallbacks()` is a RunnableBinding and does NOT
 * expose `.withStructuredOutput()`, so the previous
 * `getStructuredModel(role).withStructuredOutput(...)` pattern crashed at
 * runtime whenever more than one provider key was configured.
 */
export function getStructuredModel(
  role: ModelRole,
  schema: StructuredOutputSchema,
  options?: StructuredOutputOptions,
): Runnable<BaseLanguageModelInput, unknown> {
  const config = resolveRoleConfig(role);
  const primary = buildChatModel(
    config.primary,
    config.model,
    config.temperature,
  ).withStructuredOutput(schema, options) as Runnable<BaseLanguageModelInput, unknown>;

  if (config.fallbacks.length === 0) {
    return primary;
  }

  const fallbacks = config.fallbacks.map(
    (provider) =>
      buildChatModel(
        provider,
        providerEnv(provider).defaultModel,
        config.temperature,
      ).withStructuredOutput(schema, options) as Runnable<
        BaseLanguageModelInput,
        unknown
      >,
  );

  return primary.withFallbacks({ fallbacks });
}

/**
 * Invoke a role model with a hard timeout. LangChain's `RunnableConfig.timeout`
 * is not enforced for chat models, so the call is raced against an
 * AbortController. Without this a stalled provider leaves the chat request
 * hanging forever (which looks like a dead "localhost").
 */
export async function invokeModel<T = unknown>(
  model: Runnable<BaseLanguageModelInput, T>,
  input: BaseLanguageModelInput,
): Promise<T> {
  const timeoutMs = modelRequestTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await model.invoke(input, { signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        `AI model call timed out after ${Math.round(timeoutMs / 1000)}s. The provider may be overloaded; try another model or provider.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Log which provider/model answered, so fallbacks are never silent. */
export function logAnsweredModel(
  role: ModelRole,
  provider: string,
  model: string,
  extra: Record<string, unknown> = {},
): void {
  console.info(
    JSON.stringify({
      at: "ai-coach.model",
      role,
      provider,
      model,
      ...extra,
    }),
  );
}

/** Human-readable summary of the resolved provider chain, for diagnostics. */
export function describeModelSetup(): {
  role: ModelRole;
  primary: ModelProvider;
  model: string;
  fallbacks: ModelProvider[];
  configured: boolean;
}[] {
  return MODEL_ROLES.map((role) => {
    const config = resolveRoleConfig(role);
    return {
      role,
      primary: config.primary,
      model: config.model,
      fallbacks: config.fallbacks,
      configured: isProviderConfigured(config.primary),
    };
  });
}

/* -------------------------------------------------------------------------
 * Plain-text transport for the legacy `/api/coach` and `/api/ai/*` endpoints.
 *
 * Those endpoints speak the small `AiProvider` interface (`generateReply` with
 * plain strings) and need raw embeddings, neither of which the LangChain chat
 * models expose directly. The HTTP calls live here, in the single gateway
 * module, so no provider request exists outside `src/ai/models`.
 *
 * Failover policy intentionally stays with the caller (`resolveProviderFallback`
 * loops) because those loops also know how to repair invalid JSON by retrying
 * the same provider. Provider errors are normalised to `AiProviderError`, which
 * both the loops and the API routes already understand.
 * ---------------------------------------------------------------------- */

export type GatewayProviderId = "gemini" | "grok" | "deepseek";

export interface GatewayMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GatewayReplyInput {
  messages: GatewayMessage[];
  systemPrompt: string;
}

interface RestProviderConfig {
  apiKey: string | undefined;
  model: string;
  baseUrl?: string;
}

function restProviderConfig(provider: GatewayProviderId): RestProviderConfig {
  switch (provider) {
    case "gemini":
      return {
        apiKey: process.env.GOOGLE_GEMINI_KEY,
        model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
      };
    case "grok":
      return {
        apiKey: process.env.GROK_API_KEY,
        model: process.env.GROK_MODEL ?? "grok-4",
        baseUrl: (
          process.env.GROK_BASE_URL ?? "https://api.x.ai/v1"
        ).replace(/\/$/, ""),
      };
    case "deepseek":
      return {
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
        baseUrl: (
          process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1"
        ).replace(/\/$/, ""),
      };
  }
}

export function isRestProviderConfigured(provider: GatewayProviderId): boolean {
  return Boolean(restProviderConfig(provider).apiKey);
}

function toGeminiContents(messages: GatewayMessage[]) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

/**
 * Plain-text completion through one specific provider. Callers own the
 * failover order; this function only performs the request and normalises
 * errors.
 */
export async function generateProviderReply(
  provider: GatewayProviderId,
  input: GatewayReplyInput,
): Promise<string> {
  const config = restProviderConfig(provider);
  if (!config.apiKey) {
    throw new AiProviderError(`AI provider "${provider}" is not configured.`);
  }

  if (provider === "gemini") {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.systemPrompt }] },
          contents: toGeminiContents(input.messages),
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new AiProviderError(
        `Gemini API error ${response.status}: ${detail.slice(0, 500)}`,
      );
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) {
      throw new AiProviderError("Gemini returned an empty response.");
    }
    return text;
  }

  const label = provider === "grok" ? "Grok" : "DeepSeek";
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: input.systemPrompt },
        ...input.messages,
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new AiProviderError(
      `${label} API error ${response.status}: ${detail.slice(0, 500)}`,
    );
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new AiProviderError(`${label} returned an empty response.`);
  }
  return text;
}

/* -------------------------------------------------------------------------
 * Exercise embeddings.
 *
 * Gemini is the only configured embedding provider and the persisted index has
 * fixed dimensions, so there is no fallback provider to switch to. The request
 * still lives in the gateway module to keep all provider HTTP in one place.
 * ---------------------------------------------------------------------- */

/** Override with EMBEDDING_MODEL; defaults to Gemini's gemini-embedding-001. */
export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "gemini-embedding-001";

/** Persisted / query vector length. Must be within the model's supported range. */
export const EMBEDDING_DIMENSIONS = Number(
  process.env.EMBEDDING_DIMENSIONS ?? 768,
);

/** Gemini limits each batchEmbedContents call to a bounded number of items. */
const EMBEDDING_BATCH_SIZE = 64;

interface EmbedContentResponse {
  embeddings?: { values?: number[] }[];
}

interface GoogleApiError {
  error?: {
    message?: string;
    status?: string;
    details?: { retryDelay?: string }[];
  };
}

function requireEmbeddingKey(): string {
  const key = process.env.GOOGLE_GEMINI_KEY;
  if (!key) {
    throw new AiProviderError(
      "Exercise retrieval needs an embedding model. Set GOOGLE_GEMINI_KEY (or swap EMBEDDING_MODEL / the embed function) — see the exercise-embeddings module.",
    );
  }
  return key;
}

function parseRetryDelay(data: GoogleApiError, response: Response): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }
  const retryDelay = data.error?.details?.find(
    (detail) => detail.retryDelay,
  )?.retryDelay;
  const match = retryDelay?.match(/(\d+(?:\.\d+)?)s/);
  if (match) {
    const seconds = Number(match[1]);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }
  return 5;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Cooldown thrown on 429 so {@link embedTexts} can back off and retry. */
class RateLimitError extends Error {
  constructor(
    readonly response: Response,
    readonly data: GoogleApiError,
  ) {
    super("Embedding API rate limit exceeded.");
    this.name = "RateLimitError";
  }
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const key = requireEmbeddingKey();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      }),
    },
  );

  if (response.status === 429) {
    const data = (await response.json().catch(() => ({}))) as GoogleApiError;
    throw new RateLimitError(response, data);
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new AiProviderError(
      `Embedding API error ${response.status}: ${detail.slice(0, 500)}`,
    );
  }

  const data = (await response.json()) as EmbedContentResponse;
  const embeddings = (data.embeddings ?? []).map(
    (embedding) => embedding.values ?? [],
  );

  if (embeddings.length !== texts.length) {
    throw new AiProviderError(
      `Embedding API returned ${embeddings.length} vectors for ${texts.length} inputs.`,
    );
  }

  return embeddings;
}

/**
 * Embed a list of texts with the configured model. Retries safely through
 * free-tier rate limits.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  requireEmbeddingKey();
  if (texts.length === 0) return [];

  const vectors: number[][] = [];
  let retriesLeft = 6;

  for (let start = 0; start < texts.length; ) {
    const chunk = texts.slice(start, start + EMBEDDING_BATCH_SIZE);
    try {
      const embedded = await embedBatch(chunk);
      vectors.push(...embedded);
      start += chunk.length;
    } catch (error) {
      if (!(error instanceof RateLimitError) || retriesLeft <= 0) {
        throw error;
      }
      const delay = parseRetryDelay(error.data, error.response);
      await sleep(Math.ceil(delay * 1000) + 250);
      retriesLeft -= 1;
    }
  }
  return vectors;
}

