"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AiCoachChat } from "@/components/ai-coach/AiCoachChat";
import { AiCoachSidebar } from "@/components/ai-coach/AiCoachSidebar";
import {
  createSession,
  deleteSession,
  fetchProviders,
  fetchSessions,
  sendMessage,
  type AiProviderInfo,
  type ChatSession,
} from "@/lib/ai-coach";

export default function AiCoachPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [providerId, setProviderId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchSessions(), fetchProviders().catch(() => null)])
      .then(([loadedSessions, providerInfo]) => {
        if (cancelled) return;
        setSessions(loadedSessions);
        if (loadedSessions.length > 0) {
          setActiveId(loadedSessions[0].id);
        }
        if (providerInfo) {
          setProviders(providerInfo.providers);
          setProviderId(providerInfo.default);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load conversations from the server.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeId) ?? null,
    [sessions, activeId],
  );

  const handleNew = useCallback(async () => {
    try {
      const fresh = await createSession();
      setSessions((prev) => [fresh, ...prev]);
      setActiveId(fresh.id);
      setSidebarOpen(false);
      setError(null);
    } catch {
      setError("Could not start a new conversation.");
    }
  }, []);

  const handleSelect = useCallback((id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteSession(id);
      } catch {
        setError("Could not delete the conversation.");
        return;
      }
      const remaining = sessions.filter((session) => session.id !== id);
      setSessions(remaining);
      if (activeId === id) {
        setActiveId(remaining[0]?.id ?? null);
      }
    },
    [activeId, sessions],
  );

  const handleSend = useCallback(
    async (content: string) => {
      if (isThinking) return;
      setError(null);
      setIsThinking(true);
      try {
        let session = activeSession;
        if (!session) {
          session = await createSession();
          setSessions((prev) => [session as ChatSession, ...prev]);
          setActiveId(session.id);
        }
        const updated = await sendMessage(session.id, content, providerId);
        setSessions((prev) =>
          prev.map((current) => (current.id === updated.id ? updated : current)),
        );
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Something went wrong while sending your message.",
        );
      } finally {
        setIsThinking(false);
      }
    },
    [activeSession, isThinking, providerId],
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
          error={error}
          providers={providers}
          providerId={providerId}
          onProviderChange={setProviderId}
          onSend={handleSend}
          onNew={handleNew}
          onToggleSidebar={handleToggleSidebar}
        />
      </div>
    </div>
  );
}
