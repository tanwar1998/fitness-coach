import { AiProviderError, type AiProvider, type AiProviderId } from "./types";
import { geminiProvider } from "./providers/gemini";
import { grokProvider } from "./providers/grok";

const providers: Record<AiProviderId, AiProvider> = {
  gemini: geminiProvider,
  grok: grokProvider,
};

export type { AiProvider, AiProviderId } from "./types";

export { AiProviderError } from "./types";

export function listProviders(): {
  id: AiProviderId;
  label: string;
  configured: boolean;
}[] {
  return Object.values(providers).map((provider) => ({
    id: provider.id,
    label: provider.label,
    configured: provider.isConfigured(),
  }));
}

export function getDefaultProviderId(): AiProviderId {
  const requested = process.env.AI_PROVIDER;
  if (requested && requested in providers) {
    return requested as AiProviderId;
  }
  const configured = Object.values(providers).find((provider) =>
    provider.isConfigured(),
  );
  return configured?.id ?? "gemini";
}

export function resolveProvider(requested?: string): AiProvider {
  const raw = requested?.trim().toLowerCase() ?? getDefaultProviderId();

  if (!(raw in providers)) {
    throw new AiProviderError(
      `Unknown AI provider "${raw}". Available providers: ${Object.keys(providers).join(", ")}.`,
    );
  }

  const provider = providers[raw as AiProviderId];

  if (!provider.isConfigured()) {
    throw new AiProviderError(
      `AI provider "${provider.id}" is not configured. Add its API key to your environment (e.g. ${provider.id === "gemini" ? "GOOGLE_GEMINI_KEY" : "GROK_API_KEY"}).`,
    );
  }

  return provider;
}
