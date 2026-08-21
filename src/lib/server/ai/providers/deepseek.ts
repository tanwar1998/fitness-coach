import { SYSTEM_PROMPT } from "../system-prompt";
import {
  AiProviderError,
  type AiProvider,
  type GenerateReplyInput,
} from "../types";

const API_KEY = process.env.DEEPSEEK_API_KEY;
const MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
const BASE_URL = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1").replace(
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
      `DeepSeek API error ${response.status}: ${detail.slice(0, 500)}`,
    );
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const text = data.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new AiProviderError("DeepSeek returned an empty response.");
  }

  return text;
}

export const deepseekProvider: AiProvider = {
  id: "deepseek",
  label: "DeepSeek",
  isConfigured: () => Boolean(API_KEY),
  generateReply,
};
