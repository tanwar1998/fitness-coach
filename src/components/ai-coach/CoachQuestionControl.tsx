"use client";

import { useState } from "react";
import type { CoachQuestion } from "@/lib/coach-types";

function SendIcon({ className }: { className?: string }) {
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
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

/**
 * Rendered under the latest assistant bubble when the graph is paused.
 * ask_options shows one-tap reply plates; ask_question (e.g. "how is your
 * energy") shows a free-text field. Returning the answer resumes the graph.
 */
export function CoachQuestionControl({
  question,
  busy = false,
  onAnswer,
}: {
  question: CoachQuestion | null;
  busy?: boolean;
  onAnswer: (answer: string) => void;
}) {
  const [draft, setDraft] = useState("");

  if (!question) return null;

  const submitDraft = () => {
    const value = draft.trim();
    if (!value || busy) return;
    onAnswer(value);
    setDraft("");
  };

  return (
    <div className="border border-primary bg-card px-4 py-3.5">
      <p className="serial text-[11px] uppercase tracking-wider text-primary">
        Fit asked
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{question.question}</p>

      {question.options.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {question.options.map((option, index) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                if (!busy) onAnswer(option);
              }}
              disabled={busy}
              className="cursor-pointer border border-foreground/30 bg-card px-3.5 py-1.5 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="serial mr-1.5 text-[10px] text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              {option}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitDraft();
              }
            }}
            placeholder="Type your answer…"
            aria-label="Answer your coach's question"
            disabled={busy}
            className="min-h-9 flex-1 border border-foreground/30 bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />
          <button
            type="button"
            onClick={submitDraft}
            disabled={busy || draft.trim().length === 0}
            aria-label="Send answer"
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
          >
            <SendIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}