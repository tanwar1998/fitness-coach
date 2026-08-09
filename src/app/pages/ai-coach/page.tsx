"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { AiCoachChat } from "@/components/ai-coach/AiCoachChat";
import { AiCoachSidebar } from "@/components/ai-coach/AiCoachSidebar";
import {
  createId,
  createSession,
  fetchCoachReply,
  getServerSessionsSnapshot,
  getSessionsSnapshot,
  sessionTitleFromMessage,
  subscribeSessions,
  updateSessions,
  type ChatMessage,
} from "@/lib/ai-coach";

export default function AiCoachPage() {
  const sessions = useSyncExternalStore(
    subscribeSessions,
    getSessionsSnapshot,
    getServerSessionsSnapshot,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeId) ?? null,
    [sessions, activeId],
  );

  const handleNew = useCallback(() => {
    const fresh = createSession();
    updateSessions((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setSidebarOpen(false);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      let nextActiveId = activeId;
      updateSessions((prev) => {
        const remaining = prev.filter((session) => session.id !== id);
        if (remaining.length === 0) {
          nextActiveId = null;
          return [];
        }
        if (activeId === id) nextActiveId = remaining[0].id;
        return remaining;
      });
      setActiveId(nextActiveId);
    },
    [activeId],
  );

  const handleSend = useCallback(
    async (content: string) => {
      if (isThinking) return;

      const session = activeSession ?? createSession();
      if (!activeSession) {
        updateSessions((prev) => [session, ...prev]);
        setActiveId(session.id);
      }

      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",
        content,
        createdAt: Date.now(),
      };

      updateSessions((prev) =>
        prev.map((current) =>
          current.id === session.id
            ? {
                ...current,
                title:
                  current.title === "New chat"
                    ? sessionTitleFromMessage(content)
                    : current.title,
                messages: [...current.messages, userMessage],
                updatedAt: Date.now(),
              }
            : current,
        ),
      );
      setIsThinking(true);

      try {
        const reply = await fetchCoachReply([...session.messages, userMessage]);
        const assistantMessage: ChatMessage = {
          id: createId(),
          role: "assistant",
          content: reply,
          createdAt: Date.now(),
        };
        updateSessions((prev) =>
          prev.map((current) =>
            current.id === session.id
              ? {
                  ...current,
                  messages: [...current.messages, assistantMessage],
                  updatedAt: Date.now(),
                }
              : current,
          ),
        );
      } finally {
        setIsThinking(false);
      }
    },
    [activeSession, isThinking],
  );

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((open) => !open);
  }, []);

  return (
    <div className="flex h-[calc(100dvh-4rem)] overflow-hidden bg-background">
      <AiCoachSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessions={sessions}
        activeId={activeId}
        onSelect={handleSelect}
        onNew={handleNew}
        onDelete={handleDelete}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AiCoachChat
          session={activeSession}
          isThinking={isThinking}
          onSend={handleSend}
          onNew={handleNew}
          onToggleSidebar={handleToggleSidebar}
        />
      </div>
    </div>
  );
}
