import { SYSTEM_PROMPT } from "../system-prompt";
import {
  AiProviderError,
  type AiProvider,
  type GenerateReplyInput,
} from "../types";

const API_KEY = process.env.GROK_API_KEY;
const MODEL = process.env.GROK_MODEL ?? "grok-4";
const BASE_URL = (process.env.GROK_BASE_URL ?? "https://api.x.ai/v1").replace(
  /\/$/,
  "",
);

async function generateReply(input: GenerateReplyInput): Promise<string> {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY as string}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...input.messages,
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new AiProviderError(
      `Grok API error ${response.status}: ${detail.slice(0, 500)}`,
    );
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const text = data.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new AiProviderError("Grok returned an empty response.");
  }

  return text;
}

export const grokProvider: AiProvider = {
  id: "grok",
  label: "Grok (xAI)",
  isConfigured: () => Boolean(API_KEY),
  generateReply,
};
