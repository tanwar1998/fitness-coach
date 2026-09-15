/**
 * Sanity-check retrieval quality before wiring RAG into the full graph.
 * Runs a handful of sample queries and prints the top hits per query.
 *
 *   npm run test:retrieval
 */
import { getExerciseIndex, retrieveExercises } from "../src/lib/server/ai/exercise-retrieval";

const QUERIES = [
  "hamstring exercise with just a bench",
  "low-impact cardio option",
  "close-grip bench variation",
  "core exercise with a kettlebell at home",
  "dumbbell shoulder press",
];

const TOP_K = 5;

async function main(): Promise<void> {
  const index = getExerciseIndex();
  if (!index) {
    console.error("Exercise index missing. Run `npm run build:index` first.");
    process.exitCode = 1;
    return;
  }
  console.log(`Index: ${index.length} exercises ready.\n`);

  for (const query of QUERIES) {
    const results = await retrieveExercises(query, { topK: TOP_K });
    console.log(`Query: "${query}"`);
    if (results.length === 0) {
      console.log("  (no results)");
    } else {
      results.forEach((exercise, i) => {
        const muscles = exercise.muscles.join(", ") || "—";
        console.log(
          `  ${i + 1}. [${exercise.id}] ${exercise.name} (${exercise.category}) — ${muscles}`,
        );
      });
    }
    console.log("");
  }
}

main().catch((error) => {
  console.error("test-retrieval failed:", error);
  process.exitCode = 1;
});