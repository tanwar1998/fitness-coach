"use client";

import { useEffect, useRef } from "react";
import { AiCoachInput } from "@/components/ai-coach/AiCoachInput";
import type { AiProviderInfo, ChatMessage, ChatSession } from "@/lib/ai-coach";

interface AiCoachChatProps {
  session: ChatSession | null;
  isThinking: boolean;
  error?: string | null;
  providers?: AiProviderInfo[];
  providerId?: string;
  onProviderChange?: (id: string) => void;
  onSend: (content: string) => void;
  onNew: () => void;
  onToggleSidebar: () => void;
}

const SUGGESTIONS = [
  "Build me a 30-minute beginner workout",
  "How do I lose belly fat?",
  "Give me a quick core routine for home",
  "What should I eat after a workout?",
];

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

function NewChatIcon() {
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
      <path d="M12 5v14" />
      <path d="M5 12h14" />
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
  onProviderChange,
  onSend,
  onNew,
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
        <button
          type="button"
          onClick={onNew}
          className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <NewChatIcon />
          <span className="hidden sm:inline">New chat</span>
        </button>
      </header>

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
            <div className="mt-8 grid gap-2 text-left sm:grid-cols-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onSend(suggestion)}
                  className="cursor-pointer rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                >
                  {suggestion}
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
        />
      </div>
    </div>
  );
}
