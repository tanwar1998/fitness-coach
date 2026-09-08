import type { BaseMessage } from "@langchain/core/messages";
import { resolveProvider } from "./index";
import {
  registerCoachModel,
  type CoachModel,
} from "./graph";

/**
 * Build a {@link CoachModel} for the given provider id by reusing the same
 * plain-REST adapters the app already uses. This lets the shared LangGraph
 * graph drive every AI provider uniformly.
 */
export function makeCoachModel(providerId: string): CoachModel {
  const provider = resolveProvider(providerId);
  return {
    displayName: provider.label,
    async invoke(messages: BaseMessage[]): Promise<string> {
      return provider.generateReply({
        messages: messages.map((message) => ({
          role: message._getType() === "ai" ? "assistant" : "user",
          content:
            typeof message.content === "string"
              ? message.content
              : String(message.content),
        })),
      });
    },
  };
}

export function registerCoachModelResolver(): void {
  registerCoachModel(makeCoachModel);
}