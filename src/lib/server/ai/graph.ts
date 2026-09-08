import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { SYSTEM_PROMPT } from "./system-prompt";
import { AiProviderError, type AiMessage } from "./types";

/**
 * The LangGraph state shared by the coaching graph. Messages use LangChain's
 * standard `BaseMessage` objects; the app's lightweight `{ role, content }`
 * shape is converted at the boundary in `chat.ts`.
 */
const CoachState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  providerId: Annotation<string>(),
  /** Final assistant text produced by the graph. */
  output: Annotation<string>(),
  /**
   * Set to true by the agent node when the message is out of scope and should
   * be handed to a human coach rather than answered by the model.
   */
  requiresHuman: Annotation<boolean>(),
});

type CoachStateType = typeof CoachState.State;

interface GraphInput {
  messages: AiMessage[];
  providerId?: string;
}

/** Provider implementations register their chat-model adapters here. */
let modelForProvider:
  | ((providerId: string) => {
      invoke(input: BaseMessage[]): Promise<string>;
      displayName: string;
    })
  | null = null;

export interface CoachModel {
  invoke(messages: BaseMessage[]): Promise<string>;
  displayName: string;
}

export function registerCoachModel(
  resolver: (providerId: string) => CoachModel,
): void {
  modelForProvider = resolver;
}

export function resolveCoachModel(providerId: string): CoachModel {
  if (!modelForProvider) {
    throw new AiProviderError(
      "The LangGraph coaching graph has no registered chat model. This is a server configuration error; no AI provider likely had its key configured in time.",
    );
  }
  return modelForProvider(providerId);
}

/**
 * Deterministic safety gate. Because the app's providers are plain REST chat
 * adapters that return a single string (they cannot emit tool calls), we detect
 * out-of-scope topics here so the human hand-off path actually fires.
 */
const OUT_OF_SCOPE_PATTERNS: RegExp[] = [
  /(see|visit|call|go to|need to see) (a |the |my )?(doctor|physio|physiotherapist|er|emergency|hospital|gp|specialist)/i,
  /(is|was) it (serious|normal|safe)\b/i,
  /(could|couldn't|might|may) be (a )?(fractur|broken|injur)/i,
  /(feels?|is) (broken|sprained|fractured|dislocated)/i,
  /(chest pain|shortness of breath|difficulty breathing|can.t breathe)\b/i,
  /(seizure|passing out|blacked out|fainted?|overdos|poisoning|suicid)\b/i,
  /(numb|tingling|can.t move|unable to move|severe pain|sharp pain|worst pain)\b/i,
  /(my|the) (shoulder|knee|back|ankle|wrist|neck|elbow|hip) (hurts?|is painful|is swollen|is numb)\b/i,
  /(diagnos|prescri|medication|drug interaction)\b/i,
];

function requiresHumanReview(messages: AiMessage[]): boolean {
  const text = messages.map((message) => message.content).join("\n");
  return OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(text));
}

function toAiMessage(message: BaseMessage): AiMessage {
  return {
    role: message._getType() === "ai" ? "assistant" : "user",
    content:
      typeof message.content === "string" ? message.content : String(message.content),
  };
}

async function agentNode(state: CoachStateType): Promise<Partial<CoachStateType>> {
  const providerId = state.providerId || "gemini";
  const model = resolveCoachModel(providerId);

  const historyMessages = state.messages.filter(
    (message) => message._getType() !== "system",
  );

  // Gate on the latest incoming turn (the message the user just sent), so a
  // past out-of-scope query that was already handed to a human doesn't keep
  // re-triggering the hand-off on every follow-up.
  const lastMessage = historyMessages[historyMessages.length - 1];
  if (
    lastMessage &&
    lastMessage._getType() === "human" &&
    requiresHumanReview([toAiMessage(lastMessage)])
  ) {
    return {
      requiresHuman: true,
    };
  }

  const messages: BaseMessage[] = [
    new SystemMessage(SYSTEM_PROMPT),
    ...historyMessages,
    new HumanMessage(`(provider: ${model.displayName})`),
  ];

  const content = await model.invoke(messages);

  const trimmed = content.trim();
  if (!trimmed) {
    throw new AiProviderError(`${model.displayName} returned an empty response.`);
  }

  return {
    messages: [new AIMessage({ content: trimmed })],
    output: trimmed,
  };
}

async function fallbackNode(state: CoachStateType): Promise<Partial<CoachStateType>> {
  const reply =
    state.requiresHuman === true
      ? `That’s beyond what I can safely coach you on. I’ve flagged your message for a human coach — please get in touch with a qualified professional (a doctor, physiotherapist, or licensed dietitian) before continuing.`
      : `I couldn’t finish a safe answer to that. Please rephrase your question, and if this is about an injury or a medical condition, reach out to a qualified professional.`;
  return {
    messages: [new AIMessage({ content: reply })],
    output: reply,
  };
}

/**
 * Route after a superstep to decide the next node:
 * - requires a human reviewer (safety gate) -> "fallback"
 * - otherwise -> END (final reply is in state.output)
 */
function routeAfterAgent(state: CoachStateType): string {
  if (state.requiresHuman === true) {
    return "fallback";
  }
  return END;
}

/**
 * The shared LangGraph workflow behind the AI Coach. Every provider runs
 * through the same graph — the chosen provider is resolved inside the node via
 * {@link resolveCoachModel}, so the graph works for all AI tools without needing
 * per-provider SDK wrappers.
 */
export function buildCoachGraph() {
  const graph = new StateGraph(CoachState)
    .addNode("agent", agentNode)
    .addNode("fallback", fallbackNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", routeAfterAgent, {
      fallback: "fallback",
      [END]: END,
    })
    .addEdge("fallback", END);

  return graph.compile();
}

let compiledCoachGraph: ReturnType<typeof buildCoachGraph> | null = null;

/** Lazily compile and cache the graph (compile is CPU/validation heavy). */
export function getCoachGraph(): ReturnType<typeof buildCoachGraph> {
  if (!compiledCoachGraph) {
    compiledCoachGraph = buildCoachGraph();
  }
  return compiledCoachGraph;
}

/**
 * Ensure a provider→model resolver is registered exactly once before the first
 * run. Imported dynamically to avoid a module-load-time circular dependency
 * (the resolver imports the provider registry, which lives next to the graph).
 */
let modelResolutionPromise: Promise<void> | null = null;
async function ensureCoachModelRegistered(): Promise<void> {
  if (modelForProvider) return;
  if (!modelResolutionPromise) {
    modelResolutionPromise = import("./multiplexed-model")
      .then(({ registerCoachModelResolver }) => registerCoachModelResolver())
      .then(() => undefined)
      .catch((error) => {
        modelResolutionPromise = null;
        throw error;
      });
  }
  await modelResolutionPromise;
}

export async function runCoachGraph(input: GraphInput): Promise<{
  reply: string;
  yieldedToHuman: boolean;
}> {
  await ensureCoachModelRegistered();
  const graph = getCoachGraph();

  // The provider resolver is a module-level singleton, which is safe because
  // it is set once at startup before any request.
  const messages: BaseMessage[] = [];
  for (const msg of input.messages) {
    messages.push(
      msg.role === "assistant"
        ? new AIMessage({ content: msg.content })
        : new HumanMessage(msg.content),
    );
  }

  const result = await graph.invoke({
    messages,
    providerId: input.providerId ?? "",
  });

  // The safety gate routes to the fallback node and sets requiresHuman.
  const yieldedToHuman = result.requiresHuman === true;
  const reply =
    result.output?.trim() ||
    "I’m not able to answer that right now. Please try again.";
  return { reply, yieldedToHuman };
}