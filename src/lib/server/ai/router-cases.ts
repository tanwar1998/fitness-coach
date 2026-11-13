import type { CoachIntent } from "./intents";

/**
 * Labelled router evaluation set.
 *
 * Every intent has at least eight messages. Some are deliberately ambiguous
 * (the same noun can mean "record it" or "tell me about it"), because those are
 * the cases a keyword heuristic gets wrong and the model router must handle.
 */
export interface RouterCase {
  intent: CoachIntent;
  message: string;
  /** Confirmations only make sense while an action is waiting for a yes/no. */
  hasPendingAction?: boolean;
}

export const ROUTER_CASES: RouterCase[] = [
  // --- generate_workout -----------------------------------------------------
  { intent: "generate_workout", message: "build me a 30 minute leg workout" },
  {
    intent: "generate_workout",
    message: "can you create a new training plan for next week?",
  },
  { intent: "generate_workout", message: "make me a dumbbell routine" },
  { intent: "generate_workout", message: "I need a workout for my back" },
  { intent: "generate_workout", message: "design a beginner strength plan" },
  {
    intent: "generate_workout",
    message: "give me another workout, that one was too easy",
  },
  {
    intent: "generate_workout",
    message: "generate a home workout with no equipment",
  },
  {
    intent: "generate_workout",
    message: "I want a kettlebell session plan",
  },

  // --- log_or_edit_workout --------------------------------------------------
  { intent: "log_or_edit_workout", message: "I finished my run" },
  {
    intent: "log_or_edit_workout",
    message: "just did a 45 minute leg session, log it",
  },
  {
    intent: "log_or_edit_workout",
    message: "I completed my workout this morning",
  },
  {
    intent: "log_or_edit_workout",
    message: "please undo my last workout log",
  },
  {
    intent: "log_or_edit_workout",
    message: "delete that workout I logged yesterday",
  },
  {
    intent: "log_or_edit_workout",
    message: "I got through my training session",
  },
  {
    intent: "log_or_edit_workout",
    message: "we just did a class at the gym",
  },
  { intent: "log_or_edit_workout", message: "track this workout for me" },
  { intent: "log_or_edit_workout", message: "I skipped my workout today" },
  {
    intent: "log_or_edit_workout",
    message: "I want to log my workout",
  },

  // --- progress_goals -------------------------------------------------------
  { intent: "progress_goals", message: "how is my progress looking?" },
  { intent: "progress_goals", message: "what's my current streak?" },
  { intent: "progress_goals", message: "show me my stats for this month" },
  // Ambiguous pair with "I finished my run": same object, different request.
  { intent: "progress_goals", message: "how was my run?" },
  { intent: "progress_goals", message: "have I trained this week?" },
  { intent: "progress_goals", message: "how are my goals doing?" },
  { intent: "progress_goals", message: "what's my workout history?" },
  { intent: "progress_goals", message: "did I hit my weekly target?" },
  {
    intent: "progress_goals",
    message: "how many workouts did I do last week?",
  },
  {
    intent: "progress_goals",
    message: "did I log my workout?",
  },

  // --- nutrition_qa ---------------------------------------------------------
  { intent: "nutrition_qa", message: "how much protein should I eat?" },
  {
    intent: "nutrition_qa",
    message: "how many calories are in a banana?",
  },
  { intent: "nutrition_qa", message: "what should my macros be?" },
  { intent: "nutrition_qa", message: "is it okay to eat after 8pm?" },
  {
    intent: "nutrition_qa",
    message: "give me a high-protein meal idea",
  },
  { intent: "nutrition_qa", message: "how many kcal did I have today?" },
  { intent: "nutrition_qa", message: "what's a good diet for fat loss?" },
  {
    intent: "nutrition_qa",
    message: "should I eat before or after my workout?",
  },

  // --- general_chat ---------------------------------------------------------
  { intent: "general_chat", message: "how do I do a proper squat?" },
  { intent: "general_chat", message: "I'm feeling unmotivated today" },
  { intent: "general_chat", message: "what's the best form for a deadlift?" },
  {
    intent: "general_chat",
    message: "can you explain progressive overload?",
  },
  { intent: "general_chat", message: "I'm nervous about starting the gym" },
  {
    intent: "general_chat",
    message: "how long should I rest between sets?",
  },
  { intent: "general_chat", message: "what does RPE mean?" },
  { intent: "general_chat", message: "any tips for staying consistent?" },

  // --- confirm_pending_action ----------------------------------------------
  { intent: "confirm_pending_action", message: "yes", hasPendingAction: true },
  {
    intent: "confirm_pending_action",
    message: "yeah, do it",
    hasPendingAction: true,
  },
  { intent: "confirm_pending_action", message: "ok", hasPendingAction: true },
  { intent: "confirm_pending_action", message: "sure", hasPendingAction: true },
  {
    intent: "confirm_pending_action",
    message: "confirm",
    hasPendingAction: true,
  },
  { intent: "confirm_pending_action", message: "no", hasPendingAction: true },
  {
    intent: "confirm_pending_action",
    message: "cancel that",
    hasPendingAction: true,
  },
  {
    intent: "confirm_pending_action",
    message: "not now",
    hasPendingAction: true,
  },
];

/**
 * Pairs where the surface words are nearly identical but the intent differs.
 * A router that only looks for keywords will get one of each pair wrong.
 */
export const AMBIGUOUS_PAIRS: {
  first: string;
  firstIntent: CoachIntent;
  second: string;
  secondIntent: CoachIntent;
}[] = [
  {
    first: "I finished my run",
    firstIntent: "log_or_edit_workout",
    second: "how was my run?",
    secondIntent: "progress_goals",
  },
  {
    first: "I want to log my workout",
    firstIntent: "log_or_edit_workout",
    second: "did I log my workout?",
    secondIntent: "progress_goals",
  },
];
