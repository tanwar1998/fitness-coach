"use client";

import { useEffect, useRef, useState } from "react";
import type { AiProviderInfo } from "@/lib/ai-coach";

interface AiCoachInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  providers?: AiProviderInfo[];
  providerId?: string;
  onProviderChange?: (id: string) => void;
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

export function AiCoachInput({
  onSend,
  disabled = false,
  providers = [],
  providerId = "",
  onProviderChange,
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
        <div className="flex items-end gap-2">
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
        FitCoach AI can make mistakes. Treat its advice as a starting point, not medical guidance.
      </p>
    </div>
  );
}
