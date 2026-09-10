import categoryData from "@/lib/wger-exercisecategory.json";
import equipmentData from "@/lib/wger-equipment.json";
import muscleData from "@/lib/wger-muscle.json";

// ============================================================
// Shared wger types + helpers (used by exercise page and
// workout generator to render exercise cards / detail panels)
// ============================================================

export interface Muscle {
  id: number;
  name: string;
  name_en: string;
  is_front: boolean;
  image_url_main: string;
  image_url_secondary: string;
}

export interface Equipment {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface ExerciseImage {
  id: number;
  uuid: string;
  image: string;
  thumbnails: { small: string; medium: string } | null;
  is_main: boolean;
}

export interface Translation {
  id: number;
  uuid: string;
  name: string;
  description: string;
  language: number;
  aliases: { alias: string }[];
}

export interface ExerciseInfo {
  id: number;
  category: Category;
  muscles: Muscle[];
  muscles_secondary: Muscle[];
  equipment: Equipment[];
  images: ExerciseImage[];
  translations: Translation[];
}

export interface LocalExerciseImage {
  image_id: number;
  file: string;
  exercise_id: number;
  name: string;
  type: string;
}

export const PLACEHOLDER_CATEGORIES = new Set([
  "abs",
  "arms",
  "back",
  "calves",
  "cardio",
  "chest",
  "legs",
  "shoulders",
]);

export const CATEGORIES: Category[] = categoryData.results;
export const EQUIPMENT_LIST: Equipment[] = equipmentData.results;
export const MUSCLES: Muscle[] = muscleData.results;

export const MUSCLE_LABELS: Record<number, string> = {
  1: "Biceps",
  2: "Shoulders",
  3: "Serratus",
  4: "Chest",
  5: "Triceps",
  6: "Abs",
  7: "Calves",
  8: "Glutes",
  9: "Traps",
  10: "Quads",
  11: "Hamstrings",
  12: "Lats",
  13: "Brachialis",
  14: "Obliques",
  15: "Soleus",
};

export const MUSCLE_GROUPS: { label: string; ids: number[] }[] = [
  { label: "Upper Body", ids: [4, 2] },
  { label: "Arms", ids: [1, 5, 13] },
  { label: "Back", ids: [12, 9] },
  { label: "Core", ids: [6, 14, 3] },
  { label: "Legs", ids: [10, 11, 7, 8, 15] },
];

export const CARDIO_ID = CATEGORIES.find((c) => c.name.toLowerCase() === "cardio")?.id;

export function muscleName(id: number): string {
  return MUSCLE_LABELS[id] ?? MUSCLES.find((m) => m.id === id)?.name ?? "Muscle";
}

let localImageMapPromise: Promise<Map<number, string>> | null = null;

export function loadLocalImageMap(): Promise<Map<number, string>> {
  if (!localImageMapPromise) {
    localImageMapPromise = fetch("/exercise/images.json")
      .then((res) => res.json())
      .then((entries: LocalExerciseImage[]) => {
        const map = new Map<number, string>();
        for (const entry of entries) {
          if (!map.has(entry.exercise_id)) {
            map.set(entry.exercise_id, `/exercise/${entry.file}`);
          }
        }
        return map;
      })
      .catch(() => new Map<number, string>());
  }
  return localImageMapPromise;
}

export function getPlaceholderImage(exercise: ExerciseInfo): string {
  const slug = exercise.category.name.toLowerCase();
  const file = PLACEHOLDER_CATEGORIES.has(slug) ? slug : "generic";
  return `/exercise/placeholders/${file}.svg`;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export function getEnglishTranslation(translations: Translation[]): Translation | undefined {
  return translations.find((t) => t.language === 2);
}

export function getExerciseName(exercise: ExerciseInfo): string {
  const en = getEnglishTranslation(exercise.translations);
  if (en) return en.name;
  if (exercise.translations.length > 0) return exercise.translations[0].name;
  return "Unnamed Exercise";
}

export function getExerciseDescription(exercise: ExerciseInfo): string {
  const en = getEnglishTranslation(exercise.translations);
  const desc = en?.description || exercise.translations[0]?.description || "";
  return stripHtml(desc);
}

export function getExerciseAliases(exercise: ExerciseInfo): string[] {
  const en = getEnglishTranslation(exercise.translations);
  if (!en) return [];
  return en.aliases.map((a) => a.alias);
}

export function getExerciseImage(
  exercise: ExerciseInfo,
  localImages: Map<number, string>,
): string | null {
  const main = exercise.images.find((img) => img.is_main);
  if (main) return main.thumbnails?.medium || main.image;
  if (exercise.images.length > 0) {
    const first = exercise.images[0];
    return first.thumbnails?.medium || first.image;
  }
  return localImages.get(exercise.id) ?? null;
}

export function hasMuscleData(exercise: ExerciseInfo): boolean {
  return exercise.muscles.length > 0 || exercise.muscles_secondary.length > 0;
}

export function getMainMuscleNames(exercise: ExerciseInfo): string[] {
  return exercise.muscles.map((m) => m.name_en || m.name);
}

export function MuscleTag({
  name,
  variant,
}: {
  name: string;
  variant: "primary" | "secondary";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        variant === "primary"
          ? "bg-primary/10 text-primary"
          : "bg-secondary text-secondary-foreground"
      }`}
    >
      {variant === "primary" && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
      {name}
    </span>
  );
}