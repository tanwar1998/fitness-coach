import { AiProviderError, resolveProviderFallback } from "@/lib/server/ai";
import type { GenerateReplyInput } from "@/lib/server/ai/types";

const PARSER_SYSTEM_PROMPT = `You are a meal parsing assistant. Extract the individual food ingredients from a natural-language description of a meal.

Respond ONLY with valid JSON in this exact shape:
{
  "items": [
    { "name": "eggs", "quantity": 3, "unit": "count" }
  ]
}

Rules:
- Identify each distinct ingredient separately (e.g. "3 scrambled eggs with cheddar and toast" -> eggs, cheddar cheese, bread/toast).
- Use common, searchable English names for each ingredient (singular form, e.g. "egg", "cheddar cheese", "banana").
- Include a reasonable quantity and unit when inferable (count, slice, cup, tbsp, g).
- If a quantity is not inferable, use null for quantity and unit.
- Output only the JSON object. No markdown, no explanations, no code fences.`;

interface ParsedMeal {
  items?: { name?: string }[];
}

/**
 * Extract the first complete, balanced JSON value from a model reply.
 * The model is instructed to return JSON-only, but it sometimes wraps the
 * payload in prose or trailing text, so we tolerate that instead of failing.
 * Returns null when no JSON value can be found.
 */
function extractJson(raw: string): ParsedMeal | null {
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  try {
    return JSON.parse(clean) as ParsedMeal;
  } catch {
    // Fall through to the scan below.
  }

  for (const open of ["{", "["] as const) {
    const close = open === "{" ? "}" : "]";
    const start = clean.indexOf(open);
    if (start === -1) continue;

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < clean.length; i++) {
      const ch = clean[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === open) {
        depth++;
      } else if (ch === close) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(clean.slice(start, i + 1)) as ParsedMeal;
          } catch {
            break;
          }
        }
      }
    }
  }

  return null;
}

function buildPrompt(text: string, retry: boolean): GenerateReplyInput["messages"] {
  return [
    { role: "user", content: PARSER_SYSTEM_PROMPT },
    {
      role: "user",
      content: retry
        ? `Parse this meal description into individual ingredients:\n\n"${text}"\n\nYour previous reply was ignored because it wasn't valid JSON. Reply with ONLY a JSON object in exactly this shape (no prose, no code fences, no markdown):\n{"items":[{"name":"chicken"}]}`
        : `Parse this meal description into individual ingredients:\n\n"${text}"`,
    },
  ];
}

/**
 * Try to parse a meal through a chain of AI providers, failing over to the
 * next configured provider when one is rate-limited or overloaded. Each
 * provider gets up to two attempts: the normal prompt, then a corrective
 * one that demands strict JSON. Returns the parsed meal, or an AiProviderError
 * when every provider failed, or null when no provider produced parseable JSON.
 */
async function parseMeal(
  text: string,
  requestedProvider?: string,
): Promise<{ meal: ParsedMeal } | { providerError: AiProviderError } | { unparseable: true }> {
  const providers = resolveProviderFallback(requestedProvider);

  if (providers.length === 0) {
    return {
      providerError: new AiProviderError(
        "No AI provider is configured. Add an API key to your environment.",
      ),
    };
  }

  let lastProviderError: AiProviderError | null = null;

  for (const provider of providers) {
    try {
      let response = await provider.generateReply({
        messages: buildPrompt(text, false),
      });
      let parsed = extractJson(response);

      if (parsed === null) {
        response = await provider.generateReply({
          messages: buildPrompt(text, true),
        });
        parsed = extractJson(response);
      }

      if (parsed !== null) {
        return { meal: parsed };
      }
    } catch (error) {
      if (error instanceof AiProviderError) {
        lastProviderError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastProviderError) {
    return { providerError: lastProviderError };
  }

  return { unparseable: true };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const text =
    typeof body === "object" &&
    body !== null &&
    typeof (body as { text?: unknown }).text === "string"
      ? (body as { text: string }).text.trim()
      : "";

  const requestedProvider =
    typeof body === "object" &&
    body !== null &&
    typeof (body as { provider?: unknown }).provider === "string"
      ? (body as { provider: string }).provider
      : undefined;

  if (!text) {
    return Response.json({ error: "Meal description text is required." }, { status: 400 });
  }

  try {
    const result = await parseMeal(text, requestedProvider);

    if ("providerError" in result) {
      return Response.json({ error: result.providerError.message }, { status: 502 });
    }

    if ("unparseable" in result) {
      return Response.json(
        { error: "AI couldn't extract ingredients from that description. Please try again." },
        { status: 502 },
      );
    }

    const items = (result.meal.items ?? [])
      .filter((item) => item && typeof item.name === "string" && item.name.trim())
      .map((item) => ({ name: item.name!.trim() }));

    return Response.json({ items });
  } catch (error) {
    if (error instanceof AiProviderError) {
      return Response.json({ error: error.message }, { status: 502 });
    }
    console.error("Meal parser failed:", error);
    return Response.json(
      { error: "Something went wrong while parsing your meal." },
      { status: 500 },
    );
  }
}