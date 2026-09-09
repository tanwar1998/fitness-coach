import { AiProviderError, resolveProvider } from "@/lib/server/ai";

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

  if (!text) {
    return Response.json({ error: "Meal description text is required." }, { status: 400 });
  }

  try {
    const provider = resolveProvider();
    const raw = await provider.generateReply({
      messages: [
        { role: "user", content: PARSER_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Parse this meal description into individual ingredients:\n\n"${text}"`,
        },
      ],
    });

    const clean = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return Response.json({ error: "AI returned an unparseable meal response." }, { status: 502 });
    }

    const parsed = JSON.parse(clean.slice(start, end + 1)) as {
      items?: { name?: string }[];
    };

    const items = (parsed.items ?? [])
      .filter((item) => item && typeof item.name === "string" && item.name.trim())
      .map((item) => ({ name: item.name!.trim() }));

    return Response.json({ items });
  } catch (error) {
    if (error instanceof AiProviderError) {
      return Response.json({ error: error.message }, { status: 502 });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "AI returned invalid JSON." }, { status: 502 });
    }
    console.error("Meal parser failed:", error);
    return Response.json(
      { error: "Something went wrong while parsing your meal." },
      { status: 500 },
    );
  }
}
