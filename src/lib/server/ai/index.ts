import { AiProviderError, type AiProvider, type AiProviderId } from "./types";
import { geminiProvider } from "./providers/gemini";
import { grokProvider } from "./providers/grok";
import { deepseekProvider } from "./providers/deepseek";
import { registerCoachModelResolver } from "./multiplexed-model";

const providers: Record<AiProviderId, AiProvider> = {
  gemini: geminiProvider,
  grok: grokProvider,
  deepseek: deepseekProvider,
};

// Teach the shared LangGraph coaching graph how to reach the configured
// provider before the first chat request is handled. Imported lazily to avoid
// a module-load-time circular dependency with the graph module.
export function ensureCoachModelResolver(): void {
  registerCoachModelResolver();
}

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
      `AI provider "${provider.id}" is not configured. Add its API key to your environment (e.g. ${
        provider.id === "gemini"
          ? "GOOGLE_GEMINI_KEY"
          : provider.id === "grok"
            ? "GROK_API_KEY"
            : "DEEPSEEK_API_KEY"
      }).`,
    );
  }

  return provider;
}

/**
 * Resolve an ordered list of usable providers, preferring the requested (or
 * default) provider first and falling back to any other configured provider.
 * Lets callers fail over automatically when one provider is rate-limited,
 * overloaded, or otherwise unhealthy.
 */
export function resolveProviderFallback(requested?: string): AiProvider[] {
  const requestedId = requested?.trim().toLowerCase();
  const firstId = requestedId && requestedId in providers ? requestedId : getDefaultProviderId();
  const usable: AiProvider[] = [];

  for (const id of [firstId, ...(Object.keys(providers) as AiProviderId[])] as AiProviderId[]) {
    if (usable.some((p) => p.id === id)) continue;
    if (providers[id].isConfigured()) {
      usable.push(providers[id]);
    }
  }

  return usable;
}
