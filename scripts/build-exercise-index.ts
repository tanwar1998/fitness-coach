/**
 * One-time indexing step: load public/data/wger-exerciseinfo.json, turn each
 * exercise into an embeddable document, and persist `data/exercise-index.json`.
 *
 * Re-run only when the source JSON changes:
 *
 *   npm run build:index
 *
 * The runtime (src/lib/server/ai/exercise-retrieval.ts) loads the persisted
 * index once at startup — it never re-embeds the corpus per request.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { EMBEDDING_MODEL, embedTexts } from "../src/lib/server/ai/exercise-embeddings";

const EXERCISE_DATA_PATH = join(process.cwd(), "public", "data", "wger-exerciseinfo.json");
const OUTPUT_PATH = join(process.cwd(), "data", "exercise-index.json");

interface WgerTranslation {
  language: number;
  name: string;
  description: string;
}

interface WgerExercise {
  id: number;
  category?: { name?: string } | null;
  equipment?: { name?: string }[] | null;
  muscles?: { name_en?: string | null }[] | null;
  muscles_secondary?: { name_en?: string | null }[] | null;
  translations?: WgerTranslation[] | null;
}

interface WgerExerciseInfo {
  results?: WgerExercise[] | null;
}

const MAX_DESCRIPTION_CHARS = 800;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

interface NamedItem {
  name?: string;
  name_en?: string | null;
}

function names(values?: NamedItem[] | null): string[] {
  return (values ?? [])
    .map((item) =>
      typeof item.name_en === "string"
        ? item.name_en
        : typeof item.name === "string"
          ? item.name
          : null,
    )
    .filter((name): name is string => Boolean(name));
}

function oneLine(text: string): string {
  const cleaned = text
    .split(/\s+/)
    .join(" ")
    .trim();
  return cleaned.length > MAX_DESCRIPTION_CHARS
    ? `${cleaned.slice(0, MAX_DESCRIPTION_CHARS).trimEnd()}…`
    : cleaned;
}

function buildDocument(exercise: WgerExercise): {
  docText: string;
  item: {
    id: number;
    name: string;
    category: string;
    equipment: string[];
    muscles: string[];
    description: string;
  };
} {
  const english =
    exercise.translations?.find((translation) => translation.language === 2) ??
    exercise.translations?.[0];
  const name = english?.name ?? `Exercise ${exercise.id}`;
  const description = oneLine(stripHtml(english?.description ?? "") || "No description.");

  const category = exercise.category?.name ?? "General";
  const equipment = names(exercise.equipment);
  const muscles = names(exercise.muscles);
  const musclesSecondary = names(exercise.muscles_secondary);

  const docText = [
    name,
    `Category: ${category}`,
    `Equipment: ${equipment.length > 0 ? equipment.join(", ") : "Body weight"}`,
    `Primary muscles: ${muscles.length > 0 ? muscles.join(", ") : "—"}`,
    musclesSecondary.length > 0
      ? `Secondary muscles: ${musclesSecondary.join(", ")}`
      : "",
    `Description: ${description}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    docText,
    item: {
      id: exercise.id,
      name,
      category,
      equipment,
      muscles,
      description,
    },
  };
}

async function main(): Promise<void> {
  const raw = JSON.parse(await readFile(EXERCISE_DATA_PATH, "utf8")) as WgerExerciseInfo;
  const exercises = raw.results ?? [];

  const documents = exercises
    .map(buildDocument)
    .filter(({ item }) => item.name.toLowerCase() !== `exercise ${item.id}`);

  console.log(`Embedding ${documents.length} exercises with model "${EMBEDDING_MODEL}"…`);

  const vectors: number[][] = [];
  const CHUNK_SIZE = 128;
  for (let start = 0; start < documents.length; start += CHUNK_SIZE) {
    const chunk = documents.slice(start, start + CHUNK_SIZE);
    vectors.push(
      ...(await embedTexts(chunk.map(({ docText }) => docText))),
    );
    console.log(`  embedded ${Math.min(start + CHUNK_SIZE, documents.length)}/${documents.length}`);
  }

  const items = documents.map(({ item }, index) => ({
    ...item,
    vector: vectors[index],
  }));

  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    JSON.stringify(
      {
        model: EMBEDDING_MODEL,
        dimensions: vectors[0]?.length ?? 0,
        generatedAt: new Date().toISOString(),
        items,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Wrote ${items.length} exercises → ${OUTPUT_PATH}`);
  console.log(`Dimensions: ${vectors[0]?.length ?? 0}`);
}

main().catch((error) => {
  console.error("build-exercise-index failed:", error);
  process.exitCode = 1;
});