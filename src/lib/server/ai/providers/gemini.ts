import { SYSTEM_PROMPT } from "../system-prompt";
import {
  AiProviderError,
  type AiProvider,
  type GenerateReplyInput,
} from "../types";

const API_KEY = process.env.GOOGLE_GEMINI_KEY;
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

const GENERATION_CONFIG = {
  temperature: 0.7,
  maxOutputTokens: 2048,
};

function toGeminiContents(messages: GenerateReplyInput["messages"]) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

async function generateReply(input: GenerateReplyInput): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(API_KEY as string)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: toGeminiContents(input.messages),
      generationConfig: GENERATION_CONFIG,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new AiProviderError(
      `Gemini API error ${response.status}: ${detail.slice(0, 500)}`,
    );
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new AiProviderError("Gemini returned an empty response.");
  }

  return text;
}

export const geminiProvider: AiProvider = {
  id: "gemini",
  label: "Google Gemini",
  isConfigured: () => Boolean(API_KEY),
  generateReply,
};
