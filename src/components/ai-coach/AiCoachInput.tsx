"use client";

import { useEffect, useRef, useState } from "react";
import type { AiProviderInfo } from "@/lib/ai-coach";

export interface CoachContextProfile {
  goalLabel: string;
  injuryLabel: string | null;
}

interface AiCoachInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  providers?: AiProviderInfo[];
  providerId?: string;
  onProviderChange?: (id: string) => void;
  profile?: CoachContextProfile | null;
}

function SendIcon() {
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
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
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
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
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
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </svg>
  );
}

function GoalIcon({ className }: { className?: string }) {
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

function ShieldPillIcon({ className }: { className?: string }) {
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

export function AiCoachInput({
  onSend,
  disabled = false,
  providers = [],
  providerId = "",
  onProviderChange,
  profile,
}: AiCoachInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = value.trim().length > 0 && !disabled;

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }, [value]);

  const handleSubmit = () => {
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-input bg-card p-2 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring">
        {profile && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Context:
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
              <GoalIcon className="h-3 w-3" />
              {profile.goalLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
              <ShieldPillIcon className="h-3 w-3" />
              {profile.injuryLabel ?? "No active injuries"}
            </span>
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled
              aria-label="Attach an image (coming soon)"
              title="Image upload (coming soon)"
              className="grid h-9 w-9 cursor-default place-items-center rounded-xl text-muted-foreground/60 transition-colors hover:bg-muted disabled:pointer-events-none"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled
              aria-label="Use voice input (coming soon)"
              title="Voice input (coming soon)"
              className="grid h-9 w-9 cursor-default place-items-center rounded-xl text-muted-foreground/60 transition-colors hover:bg-muted disabled:pointer-events-none"
            >
              <MicIcon className="h-4 w-4" />
            </button>
          </div>
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask your AI coach anything..."
            aria-label="Message your AI coach"
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSend}
            aria-label="Send message"
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
          >
            <SendIcon />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
          {providers.length > 0 ? (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>AI model</span>
              <select
                value={providerId}
                onChange={(event) => onProviderChange?.(event.target.value)}
                disabled={disabled || !onProviderChange}
                className="cursor-pointer rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground focus:outline-none disabled:opacity-60"
                aria-label="Choose AI provider"
              >
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                    {provider.configured ? "" : " (needs key)"}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="text-xs text-muted-foreground">
              AI responses come from your configured providers.
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Enter to send · Shift+Enter for a new line
          </span>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        FitPulse AI can make mistakes. Treat its advice as a starting point, not medical guidance.
      </p>
    </div>
  );
}
