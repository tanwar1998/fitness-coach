"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AiCoachInput } from "@/components/ai-coach/AiCoachInput";
import type { AiProviderInfo, ChatMessage, ChatSession } from "@/lib/ai-coach";

interface AiCoachChatProps {
  session: ChatSession | null;
  isThinking: boolean;
  error?: string | null;
  providers?: AiProviderInfo[];
  providerId?: string;
  profile?: ChatProfile;
  onProviderChange?: (id: string) => void;
  onSend: (content: string) => void;
  onToggleSidebar: () => void;
}

export interface ChatProfile {
  goalLabel: string;
  injuryLabel: string | null;
}

const SUGGESTION_CARDS: {
  tag: string;
  tagClass: string;
  title: string;
  icon: ReactNode;
}[] = [
  {
    tag: "Workout",
    tagClass: "bg-purple-950/60 text-purple-400",
    title: "Build a 30-minute beginner workout",
    icon: <WorkoutIcon />,
  },
  {
    tag: "Nutrition",
    tagClass: "bg-blue-950/60 text-blue-400",
    title: "What should I eat after a workout?",
    icon: <NutritionIcon />,
  },
  {
    tag: "Cardio",
    tagClass: "bg-lime-950/60 text-lime-400",
    title: "Quick fat-burning routine for home",
    icon: <CardioIcon />,
  },
  {
    tag: "Recovery",
    tagClass: "bg-emerald-950/60 text-emerald-400",
    title: "Best core routine with no equipment",
    icon: <RecoveryIcon />,
  },
];

function WorkoutIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.4 14.4 9.6 9.6" />
      <path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z" />
      <path d="m21.5 21.5-1.4-1.4" />
      <path d="M2.5 2.5 3.9 3.9" />
    </svg>
  );
}

function NutritionIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" />
      <path d="M10 2c1 .5 2 2 2 5" />
    </svg>
  );
}

function CardioIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.5 6.5 17.5 17.5" />
      <path d="M21 21l-1-1" />
      <path d="M3 3l1 1" />
      <path d="M18 22l4-4" />
      <path d="M2 6l4-4" />
      <path d="M3 10l7-7" />
      <path d="M14 21l7-7" />
    </svg>
  );
}

function RecoveryIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </svg>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function SparkleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v3" />
      <path d="m15.5 5.5 1.5 1.5" />
      <path d="M5.5 5.5 7 7" />
      <path d="M12 15l-2.5 5" />
      <path d="m4.5 10.5-3 1.5 3 1.5" />
      <path d="m19.5 10.5 3 1.5-3 1.5" />
      <path d="M15 21l1.5-3" />
      <path d="M9 21l-1.5-3" />
      <path d="M12 15c1.5-1.5 2-3.5 2-5.5 0-2-1-3.5-2-4.5-1 1-2 2.5-2 4.5 0 2 .5 4 2 5.5Z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function CoachAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent-foreground text-primary-foreground shadow-sm ${
        size === "lg" ? "h-16 w-16" : size === "sm" ? "h-8 w-8" : "h-10 w-10"
      }`}
    >
      <SparkleIcon size={size === "lg" ? 28 : size === "sm" ? 15 : 18} />
    </span>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: `${index * 150}ms` }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground sm:max-w-[75%]">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5">
      <CoachAvatar />
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 text-sm leading-relaxed sm:max-w-[75%]">
        {message.content}
      </div>
    </div>
  );
}

export function AiCoachChat({
  session,
  isThinking,
  error = null,
  providers = [],
  providerId = "",
  profile,
  onProviderChange,
  onSend,
  onToggleSidebar,
}: AiCoachChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [session?.messages.length, isThinking]);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Open sidebar"
            className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted md:hidden"
          >
            <MenuIcon />
          </button>
          <div className="flex min-w-0 items-center gap-3">
            <CoachAvatar />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {session ? session.title : "AI Coach"}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Online
              </p>
            </div>
          </div>
        </div>
      </header>

      {profile && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground sm:px-6">
          <span className="flex items-center gap-2 font-medium text-foreground">
            <TargetIcon className="h-3.5 w-3.5 text-primary" />
            Active Goal:
            <span className="font-semibold text-primary">{profile.goalLabel}</span>
          </span>
          <span className="flex items-center gap-2 font-medium text-foreground">
            <ShieldIcon className="h-3.5 w-3.5 text-lime" />
            Active Injury Protocol:
            <span className="font-semibold">
              {profile.injuryLabel ?? "None — all clear"}
            </span>
          </span>
        </div>
      )}

      {!session || session.messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center overflow-y-auto px-4">
          <div className="mx-auto max-w-lg py-10 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
              <SparkleIcon size={30} />
            </div>
            <h1 className="mt-6 font-display text-2xl font-bold tracking-tight sm:text-4xl">
              How can I help you train today?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask about workouts, nutrition, or recovery. Each conversation is
              saved as its own session on the left.
            </p>
            <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
              {SUGGESTION_CARDS.map((card) => (
                <button
                  key={card.title}
                  type="button"
                  onClick={() => onSend(card.title)}
                  className="group cursor-pointer rounded-2xl border border-border bg-gray-900/60 p-4 text-left shadow-sm transition-all hover:border-purple-500/50 hover:bg-gray-800/80"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className={`p-1.5 rounded-lg text-xs font-semibold ${card.tagClass}`}
                    >
                      {card.tag}
                    </span>
                    <span className="text-muted-foreground group-hover:text-foreground">
                      {card.icon}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-200 transition-colors group-hover:text-white">
                    {card.title}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
            <div className="flex flex-col gap-5">
              {session.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isThinking && (
                <div className="flex items-end gap-2.5">
                  <CoachAvatar />
                  <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3.5">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="shrink-0 border-b border-danger/20 bg-danger/10 px-4 py-2.5 text-center text-sm text-danger sm:px-6">
          {error}
        </div>
      )}

      <div className="shrink-0 border-t border-border px-4 py-4 sm:px-6">
        <AiCoachInput
          onSend={onSend}
          disabled={isThinking}
          providers={providers}
          providerId={providerId}
          onProviderChange={onProviderChange}
          profile={profile}
        />
      </div>
    </div>
  );
}
