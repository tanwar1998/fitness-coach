import {
  generateProviderReply,
  isRestProviderConfigured,
} from "@/ai/models";
import { SYSTEM_PROMPT } from "../system-prompt";
import { type AiProvider, type GenerateReplyInput } from "../types";

async function generateReply(input: GenerateReplyInput): Promise<string> {
  return generateProviderReply("grok", {
    messages: input.messages,
    systemPrompt: SYSTEM_PROMPT,
  });
}

export const grokProvider: AiProvider = {
  id: "grok",
  label: "Grok (xAI)",
  isConfigured: () => isRestProviderConfigured("grok"),
  generateReply,
};
