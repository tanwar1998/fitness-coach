import type { BaseMessage } from "@langchain/core/messages";
import { AiProviderError, resolveProviderFallback } from "./index";
import {
  registerCoachModel,
  type CoachModel,
} from "./graph";

/**
 * Build a {@link CoachModel} for the given provider id by reusing the same
 * plain-REST adapters the app already uses. This lets the shared LangGraph
 * graph drive every AI provider uniformly.
 *
 * The model walks the full configured provider chain, so a provider outage
 * mid-graph rolls over to the next configured provider instead of failing the
 * turn.
 */
export function makeCoachModel(providerId: string): CoachModel {
  const providers = resolveProviderFallback(providerId);
  const primary = providers[0];

  if (!primary) {
    throw new AiProviderError(
      "No AI provider is configured. Add an API key to your environment.",
    );
  }

  return {
    displayName: primary.label,
    async invoke(messages: BaseMessage[]): Promise<string> {
      const input = {
        messages: messages.map((message) => ({
          role: message._getType() === "ai" ? ("assistant" as const) : ("user" as const),
          content:
            typeof message.content === "string"
              ? message.content
              : String(message.content),
        })),
      };

      let lastError: AiProviderError | null = null;

      for (const provider of providers) {
        try {
          return await provider.generateReply(input);
        } catch (error) {
          if (error instanceof AiProviderError) {
            lastError = error;
            continue;
          }
          throw error;
        }
      }

      throw (
        lastError ??
        new AiProviderError("All AI providers failed to produce a reply.")
      );
    },
  };
}

export function registerCoachModelResolver(): void {
  registerCoachModel(makeCoachModel);
}
