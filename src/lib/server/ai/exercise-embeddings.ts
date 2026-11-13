/**
 * Exercise embeddings now live in the model gateway (`src/ai/models`) so every
 * provider HTTP call is in one place. This module keeps the historical import
 * path for the retrieval stack.
 */
export {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  embedTexts,
} from "@/ai/models";
