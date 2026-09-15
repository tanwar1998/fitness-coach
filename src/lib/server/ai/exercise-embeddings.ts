import { AiProviderError } from "./types";

/**
 * Single swappable entry point for exercise embeddings. Change this constant
 * (or swap the implementation of {@link embedTexts}) to move to another
 * provider — nothing else in the retrieval stack needs to change.
 *
 * Override with the EMBEDDING_MODEL env var; defaults to Gemini's
 * gemini-embedding-001 (3072 dims internally, exported at 768 for a lean index).
 */
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "gemini-embedding-001";

/** Persisted / query vector length. Must be within the model's supported range. */
export const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? 768);

const API_KEY = process.env.GOOGLE_GEMINI_KEY;

const EMBED_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`;

/** Gemini limits each batchEmbedContents call to a bounded number of items. */
const BATCH_SIZE = 64;

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

function requireKey(): void {
  if (!API_KEY) {
    throw new AiProviderError(
      "Exercise retrieval needs an embedding model. Set GOOGLE_GEMINI_KEY (or swap EMBEDDING_MODEL / the embed function) — see the exercise-embeddings module.",
    );
  }
}

function parseRetryDelay(data: GoogleApiError, response: Response): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }
  const retryDelay = data.error?.details?.find((detail) => detail.retryDelay)?.retryDelay;
  const match = retryDelay?.match(/(\d+(?:\.\d+)?)s/);
  if (match) {
    const seconds = Number(match[1]);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }
  return 5;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await fetch(
    `${EMBED_URL}?key=${encodeURIComponent(API_KEY as string)}`,
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

/**
 * Embed a list of texts with the configured model. Swappable: replace this
 * function (and {@link EMBEDDING_MODEL}) to switch embedding providers.
 * Retries safely through free-tier rate limits.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  requireKey();
  if (texts.length === 0) return [];

  const vectors: number[][] = [];
  let retriesLeft = 6;

  for (let start = 0; start < texts.length; ) {
    const chunk = texts.slice(start, start + BATCH_SIZE);
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