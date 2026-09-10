import type { ExerciseInfo } from "@/lib/wger-exercise";

// Large wger datasets are served as static JSON from /public/data so they
// never enter the JS bundle. They are fetched at runtime, on demand, and
// cached per module so every consumer shares a single network request.

export const EXERCISE_INFO_URL = "/data/wger-exerciseinfo.json";
export const INGREDIENT_INFO_URL = "/data/wger-ingredientinfo.json";

export interface WeightUnit {
  id: number;
  gram: number;
  name: string;
}

export interface Ingredient {
  id: number;
  name: string;
  brand: string | null;
  energy: number;
  protein: string;
  carbohydrates: string;
  carbohydrates_sugar: string;
  fat: string;
  fat_saturated: string;
  fiber: string;
  sodium: string;
  weight_units: WeightUnit[];
}

interface ResultsEnvelope<T> {
  count: number;
  next: null;
  previous: null;
  results: T[];
}

function createCachedLoader<T>(path: string): () => Promise<T[]> {
  let promise: Promise<T[]> | null = null;
  return () => {
    if (!promise) {
      promise = fetch(path)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to load ${path}: ${res.status}`);
          }
          return res.json() as Promise<ResultsEnvelope<T>>;
        })
        .then((data) => data.results)
        .catch((err) => {
          promise = null;
          throw err;
        });
    }
    return promise;
  };
}

export const loadExerciseInfo = createCachedLoader<ExerciseInfo>(
  EXERCISE_INFO_URL,
);

export const loadIngredientInfo = createCachedLoader<Ingredient>(
  INGREDIENT_INFO_URL,
);