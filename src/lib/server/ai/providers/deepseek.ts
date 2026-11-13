import {
  generateProviderReply,
  isRestProviderConfigured,
} from "@/ai/models";
import { SYSTEM_PROMPT } from "../system-prompt";
import { type AiProvider, type GenerateReplyInput } from "../types";

async function generateReply(input: GenerateReplyInput): Promise<string> {
  return generateProviderReply("deepseek", {
    messages: input.messages,
    systemPrompt: SYSTEM_PROMPT,
  });
}

export const deepseekProvider: AiProvider = {
  id: "deepseek",
  label: "DeepSeek",
  isConfigured: () => isRestProviderConfigured("deepseek"),
  generateReply,
};
