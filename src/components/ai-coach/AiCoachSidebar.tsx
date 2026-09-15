"use client";

import { useMemo } from "react";
import type { ChatSession } from "@/lib/ai-coach";

interface AiCoachSidebarProps {
  open: boolean;
  collapsed?: boolean;
  onClose: () => void;
  onToggleCollapse?: () => void;
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function PlusIcon() {
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
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function ChatIcon() {
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
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function CloseIcon() {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ChevronsLeftIcon() {
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
      <path d="m11 17-5-5 5-5" />
      <path d="m18 17-5-5 5-5" />
    </svg>
  );
}

function ChevronsRightIcon() {
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
      <path d="m6 17 5-5-5-5" />
      <path d="m13 17 5-5-5-5" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function startOfDay(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function groupLabel(timestamp: number) {
  const diffDays = Math.round((startOfDay(Date.now()) - startOfDay(timestamp)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "Previous 7 days";
  if (diffDays < 30) return "Previous 30 days";
  return "Older";
}

export function AiCoachSidebar({
  open,
  collapsed = false,
  onClose,
  onToggleCollapse,
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: AiCoachSidebarProps) {
  const groups = useMemo(() => {
    const ordered = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    const map = new Map<string, ChatSession[]>();
    for (const session of ordered) {
      const label = groupLabel(session.updatedAt);
      const list = map.get(label) ?? [];
      list.push(session);
      map.set(label, list);
    }
    return Array.from(map.entries());
  }, [sessions]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-hidden border-r border-foreground/15 bg-background transition-[width,transform] duration-300 md:static md:z-auto ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${collapsed ? "md:w-14" : "md:w-72"}`}
      >
        {/* Desktop rail shown when the drawer is collapsed */}
        <div
          className={`h-full flex-col items-center justify-center gap-2 p-3 ${
            collapsed ? "hidden md:flex" : "hidden"
          }`}
        >
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand chat history"
            className="grid h-11 w-11 cursor-pointer place-items-center border border-foreground/20 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronsRightIcon />
          </button>
        </div>

        {/* Full content (hidden on desktop when collapsed) */}
        <div
          className={`flex min-h-0 flex-1 flex-col  ${
            collapsed ? "hidden md:hidden" : "flex"
          }`}
        >
        <div className="flex items-center gap-2 border-b border-foreground/15 p-4">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse chat history"
            className="hidden h-11 w-11 shrink-0 cursor-pointer place-items-center border border-foreground/20 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:grid"
          >
            <ChevronsLeftIcon />
          </button>
          <button
            type="button"
            onClick={onNew}
            className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 bg-primary px-4 font-display text-sm font-black uppercase tracking-wide text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <PlusIcon />
            New chat
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="grid h-11 w-11 cursor-pointer place-items-center border border-foreground/20 text-muted-foreground transition-colors hover:bg-muted md:hidden"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <span className="border border-foreground/20 bg-muted p-3 text-muted-foreground">
                <HistoryIcon />
              </span>
              <p className="mt-4 text-sm font-medium text-muted-foreground">
                No conversations yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                Your past chat threads will appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map(([label, items]) => (
                <div key={label}>
                  <p className="stamp px-2 pb-1.5 text-muted-foreground">
                    {label}
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {items.map((session) => {
                      const active = session.id === activeId;
                      return (
                        <li key={session.id}>
                          <div
                            className={`group flex w-full items-center gap-1 transition-colors ${
                              active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => onSelect(session.id)}
                              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left"
                            >
                              <span className={active ? "text-primary-foreground" : "text-muted-foreground"}>
                                <ChatIcon />
                              </span>
                              <span
                                className={`truncate text-sm ${
                                  active
                                    ? "font-semibold text-primary-foreground"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {session.title}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(session.id)}
                              aria-label={`Delete ${session.title}`}
                              className={`mr-1 grid h-8 w-8 shrink-0 cursor-pointer place-items-center text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                active
                                  ? "opacity-100"
                                  : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                              }`}
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </nav>

        <div className="border-t border-foreground/15 p-4">
          <p className="text-xs text-muted-foreground">
            Conversations are saved on the server.
          </p>
        </div>
        </div>
      </aside>
    </>
  );
}
