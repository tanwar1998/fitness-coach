import {
  generateProviderReply,
  isRestProviderConfigured,
} from "@/ai/models";
import { SYSTEM_PROMPT } from "../system-prompt";
import { type AiProvider, type GenerateReplyInput } from "../types";

async function generateReply(input: GenerateReplyInput): Promise<string> {
  return generateProviderReply("gemini", {
    messages: input.messages,
    systemPrompt: SYSTEM_PROMPT,
  });
}

export const geminiProvider: AiProvider = {
  id: "gemini",
  label: "Google Gemini",
  isConfigured: () => isRestProviderConfigured("gemini"),
  generateReply,
};
