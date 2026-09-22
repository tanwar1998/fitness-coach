import { NextResponse } from "next/server";

const BASE_URL =
  process.env.NUTRITION_SCAN_BASE_URL ??
  "https://vineettheidiot-fitgenie-calorie-clip-1.hf.space";

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const SCAN_TIMEOUT_MS = 90_000;

interface ScanResult {
  calories: number;
  food_label: string;
  confidence: number;
  protein_g: number;
  fat_g: number;
  fiber_g: number;
  carbs_g: number;
}

function authHeaders(): Record<string, string> {
  return process.env.HF_TOKEN
    ? { Authorization: `Bearer ${process.env.HF_TOKEN}` }
    : {};
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeResult(raw: unknown): ScanResult {
  const result = (raw ?? {}) as Record<string, unknown>;
  return {
    calories: num(result.calories),
    food_label:
      typeof result.food_label === "string" && result.food_label.trim()
        ? result.food_label.trim()
        : "Unknown dish",
    confidence: num(result.confidence),
    protein_g: num(result.protein_g),
    fat_g: num(result.fat_g),
    fiber_g: num(result.fiber_g),
    carbs_g: num(result.carbs_g),
  };
}

async function uploadImage(file: File, signal: AbortSignal): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const blob = new Blob([bytes], { type: file.type || "image/jpeg" });
  const form = new FormData();
  form.append("files", blob, file.name || "photo.jpg");

  const response = await fetch(`${BASE_URL}/gradio_api/upload`, {
    method: "POST",
    body: form,
    headers: authHeaders(),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Image upload failed with status ${response.status}.`);
  }

  const data = (await response.json()) as unknown;
  const path =
    Array.isArray(data) && typeof data[0] === "string" ? data[0] : null;
  if (!path) {
    throw new Error("The scan service did not accept that image.");
  }
  return path;
}

async function submitPrediction(
  uploadedPath: string,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(`${BASE_URL}/gradio_api/call/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      data: [{ path: uploadedPath, meta: { _type: "gradio.FileData" } }],
    }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Prediction request failed with status ${response.status}.`);
  }

  const body = (await response.json()) as { event_id?: unknown };
  if (typeof body.event_id !== "string" || body.event_id === "") {
    throw new Error("The scan service returned no prediction id.");
  }
  return body.event_id;
}

/**
 * Stream the SSE endpoint for a prediction until it reports "complete" and
 * resolve with the prediction payload. Rejects on an "error" event.
 */
async function waitForResult(
  eventId: string,
  signal: AbortSignal,
): Promise<ScanResult> {
  const response = await fetch(
    `${BASE_URL}/gradio_api/call/predict/${encodeURIComponent(eventId)}`,
    { headers: authHeaders(), signal },
  );
  if (!response.ok) {
    throw new Error(`Prediction stream failed with status ${response.status}.`);
  }

  const raw = await response.text();
  for (const part of raw.split("\n\n")) {
    const eventLine = part.split("\n").find((line) => line.startsWith("event:"));
    const dataLine = part.split("\n").find((line) => line.startsWith("data:"));
    if (!eventLine || !dataLine) continue;

    const eventType = eventLine.slice("event:".length).trim();
    const payload = dataLine.slice("data:".length).trim();

    if (eventType === "error") {
      throw new Error(payload || "The scan service reported an error.");
    }
    if (eventType === "complete") {
      const parsed = JSON.parse(payload) as unknown;
      const value = Array.isArray(parsed) ? parsed[0] : parsed;
      return normalizeResult(value);
    }
  }

  throw new Error("The scan service timed out before returning a result.");
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form data with an image field." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No image file was provided." },
      { status: 400 },
    );
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "The uploaded file must be an image." },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json(
      { error: "The uploaded image appears to be empty." },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "Images must be 12 MB or smaller." },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

  try {
    const uploadedPath = await uploadImage(file, controller.signal);
    const eventId = await submitPrediction(uploadedPath, controller.signal);
    const result = await waitForResult(eventId, controller.signal);

    return NextResponse.json({
      foodLabel: result.food_label,
      confidence: result.confidence,
      calories: result.calories,
      protein: result.protein_g,
      fat: result.fat_g,
      fiber: result.fiber_g,
      carbs: result.carbs_g,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "The scan took too long. Try a clearer, well-lit photo." },
        { status: 504 },
      );
    }
    console.error("Nutrition scan failed:", error);
    return NextResponse.json(
      { error: "Could not analyze that photo. Please try again." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}