import { readFileSync } from "node:fs";
import { join } from "node:path";
import { embedTexts } from "./exercise-embeddings";

/**
 * Retrieval-augmented generation over the wger exercise database.
 *
 * The heavy lifting (embedding all ~860 exercises) happens once in the offline
 * `scripts/build-exercise-index.ts` step, which persists `data/exercise-index.json`.
 * At runtime the index is read from disk exactly once (lazy singleton) and kept
 * in memory — it is never rebuilt per request, and no network happens at import
 * time. The only per-request network call is embedding the search query.
 */

/** One persisted entry in data/exercise-index.json. */
export interface ExerciseIndexItem {
  id: number;
  name: string;
  category: string;
  equipment: string[];
  muscles: string[];
  description: string;
  /** Pre-computed embedding vector for page_content. */
  vector: number[];
}

export interface ExerciseIndexJson {
  model: string;
  dimensions: number;
  generatedAt: string;
  items: ExerciseIndexItem[];
}

/** Subset served to the graph and prompt (never includes raw vectors). */
export interface RetrievedExercise {
  id: number;
  name: string;
  category: string;
  equipment: string[];
  muscles: string[];
  description: string;
}

/** Optional known profile info folded into the retrieval query. */
export interface CoachProfile {
  goal?: string;
  equipment?: string[];
  targetMuscle?: string;
}

const EXERCISE_INDEX_PATH = join(process.cwd(), "data", "exercise-index.json");

let cachedIndex: ExerciseIndexItem[] | null | undefined;
let warnedOnce = false;

/** Load the persisted index once per process; null when it is missing/invalid. */
export function getExerciseIndex(): ExerciseIndexItem[] | null {
  if (cachedIndex !== undefined) return cachedIndex;

  try {
    const raw = readFileSync(EXERCISE_INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw) as ExerciseIndexJson;
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      throw new Error("Index has no items.");
    }
    cachedIndex = parsed.items;
  } catch (error) {
    if (!warnedOnce) {
      warnedOnce = true;
      console.warn(
        `Exercise index not available at ${EXERCISE_INDEX_PATH}. ` +
          "Run `npm run build:index` once to build it. " +
          `(${error instanceof Error ? error.message : String(error)})`,
      );
    }
    cachedIndex = null;
  }

  return cachedIndex;
}

/**
 * Compose the retrieval query from the latest user message plus any known
 * profile info (goal, equipment on hand, target muscle group).
 */
export function buildRetrievalQuery(
  latestUserMessage: string,
  profile?: CoachProfile,
): string {
  const parts = [latestUserMessage.trim()];

  if (profile?.goal) parts.push(`Goal: ${profile.goal}`);
  if (profile?.targetMuscle) parts.push(`Target muscles: ${profile.targetMuscle}`);
  if (profile?.equipment && profile.equipment.length > 0) {
    parts.push(`Equipment on hand: ${profile.equipment.join(", ")}`);
  }

  return parts.join("\n");
}

function normalize(vector: number[]): number[] {
  let magnitude = 0;
  for (const value of vector) magnitude += value * value;
  magnitude = Math.sqrt(magnitude) || 1;
  return vector.map((value) => value / magnitude);
}

/** Convert a stored item to the shape consumed by the graph (dropping vectors). */
function toRetrievedExercise(item: ExerciseIndexItem): RetrievedExercise {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    equipment: item.equipment,
    muscles: item.muscles,
    description: item.description,
  };
}

/**
 * Embed the query and return the top `topK` exercises by cosine similarity.
 * Returns an empty list when the index is missing (chat still works). Throws on
 * embedding errors so the graph can decide how to degrade.
 */
export async function retrieveExercises(
  query: string,
  options: { topK?: number; profile?: CoachProfile } = {},
): Promise<RetrievedExercise[]> {
  const { topK = 6, profile } = options;
  const index = getExerciseIndex();
  if (!index || index.length === 0) return [];

  const queryText = buildRetrievalQuery(query, profile);
  const [embedded] = await embedTexts([queryText]);
  const queryVector = normalize(embedded);

  const scored = index
    .filter((item) => item.vector.length === queryVector.length)
    .map((item) => {
      const stored = normalize(item.vector);
      let score = 0;
      for (let i = 0; i < queryVector.length; i++) {
        score += queryVector[i] * stored[i];
      }
      return { item, score };
    });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(({ item }) => toRetrievedExercise(item));
}

/** Format retrieved exercises compactly for the coach prompt. */
export function formatRetrievedExercises(exercises: RetrievedExercise[]): string {
  return exercises
    .map((exercise) => {
      const muscles = exercise.muscles.join(", ") || "—";
      return `- ${exercise.name} — ${exercise.category} — ${muscles} — ${exercise.description}`;
    })
    .join("\n");
}