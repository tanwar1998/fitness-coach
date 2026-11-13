/**
 * Feature flags and env handling for the AI coach graph v2.
 *
 * Everything new is OFF by default, so the existing coaching graph keeps
 * behaving exactly as before until these are explicitly enabled:
 *
 *   COACH_GRAPH_MODE=legacy | langgraph   (default: legacy)
 *   COACH_SSE_ENABLED=true                (default: false)
 *   LANGSMITH_TRACING=true                (default: false, also needs LANGSMITH_API_KEY)
 */

export type CoachGraphMode = "legacy" | "langgraph";

/** Which coaching graph the chat endpoints should run. */
export function getCoachGraphMode(): CoachGraphMode {
  return process.env.COACH_GRAPH_MODE?.trim().toLowerCase() === "langgraph"
    ? "langgraph"
    : "legacy";
}

/** True when the v2 intent-routing graph is enabled. */
export function isGraphV2Enabled(): boolean {
  return getCoachGraphMode() === "langgraph";
}

/** True when the new streaming endpoint should be served. */
export function isSseEnabled(): boolean {
  return process.env.COACH_SSE_ENABLED?.trim().toLowerCase() === "true";
}

/** True when LangSmith tracing should be wired up. */
export function isLangSmithEnabled(): boolean {
  return (
    process.env.LANGSMITH_TRACING?.trim().toLowerCase() === "true" &&
    Boolean(process.env.LANGSMITH_API_KEY)
  );
}

/**
 * LangSmith run config attached to every graph invocation when tracing is on,
 * or undefined when it is off. LangGraph/LangChain read LANGSMITH_* env vars,
 * so this only adds per-run metadata for filtering in the UI.
 */
export function tracingRunConfig(
  metadata: Record<string, unknown>,
): { runName?: string; tags?: string[]; metadata?: Record<string, unknown> } | undefined {
  if (!isLangSmithEnabled()) return undefined;
  return {
    runName: "ai-coach",
    tags: ["ai-coach", String(metadata.intent ?? "routing")],
    metadata,
  };
}

/** Checkpointer backend hint: prod runs Postgres, dev can stay in memory. */
export function wantsPostgresCheckpointer(): boolean {
  if (process.env.COACH_CHECKPOINTER?.trim().toLowerCase() === "memory") {
    return false;
  }
  return Boolean(process.env.DATABASE_URL);
}
