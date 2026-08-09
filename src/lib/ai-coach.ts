import exercisesList from "@/data/exercisesList.json";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "fitcoach-ai-sessions";

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSession(): ChatSession {
  const now = Date.now();
  return {
    id: createId(),
    title: "New chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function sessionTitleFromMessage(content: string) {
  const cleaned = content.replace(/\s+/g, " ").trim();
  return cleaned.length > 40 ? `${cleaned.slice(0, 40).trim()}…` : cleaned || "New chat";
}

export function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatSession[]) : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: ChatSession[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    return;
  }
}

let currentSessions: ChatSession[] = [];

if (typeof window !== "undefined") {
  currentSessions = loadSessions();
}

const sessionListeners = new Set<() => void>();

function emitSessions() {
  sessionListeners.forEach((listener) => listener());
}

export function subscribeSessions(listener: () => void) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

export function getSessionsSnapshot(): ChatSession[] {
  return currentSessions;
}

export function getServerSessionsSnapshot(): ChatSession[] {
  return [];
}

export function updateSessions(updater: (prev: ChatSession[]) => ChatSession[]) {
  currentSessions = updater(currentSessions);
  saveSessions(currentSessions);
  emitSessions();
}

interface ExerciseEntry {
  id: number;
  name: string;
  description: string;
  type?: string[];
  level?: string[];
  area: string[];
}

const warmupPool = exercisesList.warmup as unknown as ExerciseEntry[];
const workoutPool = exercisesList.workout as unknown as ExerciseEntry[];
const cooldownPool = exercisesList.cooldown as unknown as ExerciseEntry[];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pick(pool: ExerciseEntry[], count: number) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function pickByArea(pool: ExerciseEntry[], area: string, count: number) {
  const matches = pool.filter((entry) => entry.area.includes(area));
  return pick(matches.length > 0 ? matches : pool, count);
}

function durationFromInput(text: string) {
  const match = text.match(/\b(\d{1,3})\s*(min|mins|minute|minutes)\b/);
  return match ? Number(match[1]) : 30;
}

function levelFromInput(text: string) {
  if (/(beginner|new)/.test(text)) return "beginner";
  if (/(advanced|hard)/.test(text)) return "advanced";
  if (/(intermediate|moderate)/.test(text)) return "intermediate";
  return "beginner";
}

function areaFromInput(text: string) {
  if (/(leg|lower body|lower-body|glute|quad|hamstring|thigh|hip)/.test(text)) return "lower";
  if (/(arm|upper body|upper-body|shoulder|chest|back|push|pull)/.test(text)) return "upper";
  if (/(core|abs|abdominal|plank)/.test(text)) return "core";
  return "full";
}

const AREA_LABEL: Record<string, string> = {
  lower: "lower body",
  upper: "upper body",
  core: "core",
  full: "full body",
};

function listExercises(exercises: ExerciseEntry[]) {
  return exercises.map((entry) => `• ${entry.name}`).join("\n");
}

function buildWorkoutReply(input: string) {
  const duration = durationFromInput(input);
  const level = levelFromInput(input);
  const area = areaFromInput(input);
  const mainMinutes = Math.max(10, duration - 10);

  const warmups = pickByArea(warmupPool, area, 3);
  const main = pickByArea(workoutPool, area, 4);
  const cooldowns = pickByArea(cooldownPool, area, 2);

  const mainText = main
    .map((entry) => `• ${entry.name} — 3 sets of 10-12 reps (rest 45-60s)`)
    .join("\n");

  return [
    `Here's a ${duration}-minute ${level} routine focused on your ${AREA_LABEL[area]}, using real exercises from the FitCoach library.`,
    `Warm-up (5 minutes)\n${listExercises(warmups)}`,
    `Main session (${mainMinutes} minutes)\n${mainText}`,
    `Cool-down (5 minutes)\n${listExercises(cooldowns)}`,
    `Start lighter than you think you need, and only add weight or reps when the last set feels comfortable.`,
  ].join("\n\n");
}

function buildFatLossReply() {
  const moves = listExercises(pickByArea(workoutPool, "full", 3));
  return [
    "Fat loss comes from a consistent calorie deficit, not quick fixes. Aim for a modest 300-500 kcal daily deficit while protecting muscle.",
    "Here's a plan:",
    "1. Eat 1.6-2.2 g of protein per kg of bodyweight, spread across meals\n2. Strength train 3-4 times per week so the weight you lose is fat, not muscle\n3. Add 2-3 cardio sessions — these moves from the library fit well into circuits:\n" +
      moves +
      "\n4. Walk 30-45 minutes daily; it adds up more than any workout gimmick\n5. Sleep 7-9 hours to keep hunger hormones in check",
    "Weigh yourself weekly, not daily, and only adjust calories when the trend has stalled for two weeks or more.",
  ].join("\n\n");
}

function buildMuscleReply() {
  const moves = listExercises(pickByArea(workoutPool, "full", 4));
  return [
    "Muscle growth comes from progressive overload: doing slightly more than last time, week after week.",
    "Focus on:",
    "1. Training each muscle group twice per week\n2. Working in the 6-12 rep range, finishing 1-3 reps short of failure\n3. Prioritizing compound lifts — strong options from the library:\n" +
      moves +
      "\n4. Eating a small surplus with 1.6-2.2 g of protein per kg of bodyweight\n5. Sleeping 7-9 hours; growth happens during recovery, not in the gym",
    "Start with three sessions per week and only add volume when progress stalls.",
  ].join("\n\n");
}

function buildCardioReply() {
  const moves = listExercises(pickByArea(workoutPool, "full", 3));
  return [
    "To improve endurance, blend steady-state work with intervals.",
    "A balanced week looks like:",
    "1. Two steady sessions at a pace you can hold for 30-45 minutes\n2. One interval session — for example 6 rounds of 45s hard / 90s easy\n3. One or two strength sessions to keep joints and muscles resilient\n4. At least one full rest day",
    `For interval work, these full-body moves from the library work great:\n${moves}`,
    "Aim to finish each hard interval around 85-90% of max effort, then recover fully before the next one.",
  ].join("\n\n");
}

function buildCoreReply() {
  const moves = listExercises(pickByArea(workoutPool, "core", 5));
  return [
    "A strong core is about bracing, not grinding out hundreds of reps. Train it 2-3 times per week with control.",
    `A solid core circuit from the FitCoach library:\n${moves}`,
    "Repeat the circuit 2-3 times with 45-60s rest between rounds. Breathe steadily, keep your ribs down, and hold your hips stable on every rep. Your core also works hard during squats and deadlifts, so don't skip those either.",
  ].join("\n\n");
}

function buildBeginnerReply() {
  const beginnerPool = workoutPool.filter((entry) => entry.level?.includes("beginner"));
  const moves = listExercises(pick(beginnerPool.length > 0 ? beginnerPool : workoutPool, 4));
  return [
    "Starting is the hardest part — keep the first weeks simple and consistent.",
    "A sensible beginner plan:",
    "1. Train 2-3 days per week with at least one rest day between sessions\n2. Do full-body workouts so every muscle gets enough recovery\n3. Pick exercises you can complete with clean form for 8-12 reps\n4. Add a 5-minute warm-up and 5-minute cool-down to every session",
    `Here are a few beginner-friendly picks from the library:\n${moves}`,
    "Focus on consistency first, intensity later. If you feel sharp pain rather than mild muscle soreness, back off.",
  ].join("\n\n");
}

function buildNutritionReply() {
  return [
    "Good nutrition supports everything else. You don't need a perfect diet, just a few reliable habits:",
    "1. Hit 1.6-2.2 g of protein per kg of bodyweight, spread across meals\n2. Get most of your calories from minimally processed foods\n3. Around training, have a meal with protein and carbs 1-2 hours before, and another within a couple of hours after\n4. Drink water through the day — thirst is easily mistaken for hunger",
    "For fat loss eat slightly below maintenance; for muscle gain eat slightly above. Change by 200-300 kcal at a time and watch the two-week trend before adjusting again.",
  ].join("\n\n");
}

function buildRecoveryReply() {
  return [
    "Recovery is where the gains happen. If you're dealing with soreness:",
    "• Take a rest day or switch to light movement like walking or stretching\n• Keep protein intake high and sleep 7-9 hours\n• Gentle foam rolling and mobility work can help you feel better",
    "If you have sharp pain, swelling, or pain that doesn't improve within a week or two, see a doctor or physiotherapist — that's beyond what an app should handle.",
  ].join("\n\n");
}

function buildMotivationReply() {
  return [
    "Motivation tends to show up after action, not before. A few ways to make training stick:",
    "• Schedule workouts like meetings — same time, same place\n• Start with a 10-minute minimum; small sessions beat skipped ones\n• Track something each week, even just your show-up count\n• Pair training with something you enjoy, like a podcast or playlist",
    "A plateau usually means it's time to change one variable: add a set, shorten rest, or swap in new exercises. Keep it simple and stay consistent.",
  ].join("\n\n");
}

function buildGreetingReply() {
  return [
    "Hey! I'm your FitCoach AI assistant, here to help you train smarter.",
    "You can ask me about:\n• Building workouts for any goal\n• Nutrition and diet planning\n• Fat loss, muscle gain, or endurance\n• Recovery, soreness, and injury prevention",
    'Try something like "Build me a 20-minute cardio workout" or "What should I eat after training?"',
  ].join("\n\n");
}

function buildGeneralReply() {
  return [
    "I'm here to help with training, nutrition, and recovery. Here's what I can do:",
    "• Build a workout around your time, level, and goal\n• Explain exercises from the FitCoach library\n• Suggest nutrition and protein guidance\n• Help you plan for fat loss, muscle gain, or better endurance",
    "Tell me about your current routine and your main goal, and I'll give you something specific to work with.",
  ].join("\n\n");
}

function buildCoachReply(input: string) {
  const text = input.toLowerCase().trim();

  if (/^(hi|hello|hey|yo|hiya|sup|good (morning|afternoon|evening))\b/.test(text)) {
    return buildGreetingReply();
  }
  if (/(injur|pain|sore|ache|hurt|recover|rest day)/.test(text)) {
    return buildRecoveryReply();
  }
  if (/(lose weight|fat|belly|slim|shred|cut|weight loss|deficit)/.test(text)) {
    return buildFatLossReply();
  }
  if (/(muscle|gain|bulk|grow|size|hypertrophy|strength)/.test(text)) {
    return buildMuscleReply();
  }
  if (/(cardio|run|running|jog|endurance|stamina|hiit|conditioning|aerobic)/.test(text)) {
    return buildCardioReply();
  }
  if (/(core|abs|abdominal|six.?pack|plank)/.test(text)) {
    return buildCoreReply();
  }
  if (/(beginner|new to|starting out|just started|first time|novice)/.test(text)) {
    return buildBeginnerReply();
  }
  if (/(eat|nutrition|diet|food|meal|protein|calorie|macros|breakfast|lunch|dinner)/.test(text)) {
    return buildNutritionReply();
  }
  if (/(motivat|consisten|habit|discipline|stuck|give up|bored|plateau)/.test(text)) {
    return buildMotivationReply();
  }
  if (/(workout|routine|exercise|session|plan|training|program|circuit|warm.?up)/.test(text)) {
    return buildWorkoutReply(text);
  }
  return buildGeneralReply();
}

export async function fetchCoachReply(messages: ChatMessage[]): Promise<string> {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const input = lastUser ? lastUser.content : "";
  await delay(700 + Math.random() * 900);
  return buildCoachReply(input);
}
