export type AiProviderId = "gemini" | "grok";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateReplyInput {
  messages: AiMessage[];
}

export interface AiProvider {
  id: AiProviderId;
  label: string;
  isConfigured(): boolean;
  generateReply(input: GenerateReplyInput): Promise<string>;
}

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}
