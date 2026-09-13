"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AiCoachChat, type ChatProfile } from "@/components/ai-coach/AiCoachChat";
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
import { fetchInjuries, BODY_REGION_LABELS } from "@/lib/injury-recovery";
import { computeReadinessScore, fetchCheckIns } from "@/lib/injury-recovery";
import { WORKOUT_GOALS, type WorkoutGoal } from "@/lib/workout-generator";
import { loadHistory } from "@/lib/workout-history";

const GOAL_LABELS: Record<WorkoutGoal, string> = Object.fromEntries(
  WORKOUT_GOALS.map((option) => [option.value, option.label]),
) as Record<WorkoutGoal, string>;

export default function AiCoachPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [providerId, setProviderId] = useState<string>("");
  const [injuryLabel, setInjuryLabel] = useState<string | null>(null);
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [goalLabel] = useState<string>(() => {
    const latest = loadHistory()[0]?.workout;
    return latest?.goal ? GOAL_LABELS[latest.goal] : "General fitness";
  });

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

  useEffect(() => {
    let cancelled = false;
    fetchInjuries()
      .then((injuries) => {
        if (cancelled) return;
        const active = injuries
          .filter((injury) => injury.status !== "cleared")
          .sort((a, b) => (a.status === "active" ? -1 : 1) - (b.status === "active" ? -1 : 1));
        if (active.length === 0) {
          setInjuryLabel(null);
          return;
        }
        const labels = active.map((injury) => {
          const region = BODY_REGION_LABELS[injury.region] ?? injury.region;
          return injury.status === "active" ? `${region} (Active)` : `${region} (Healing)`;
        });
        setInjuryLabel([...new Set(labels)].join(", "));
      })
      .catch(() => {
        if (cancelled) setInjuryLabel(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCheckIns()
      .then((checkIns) => {
        if (cancelled) return;
        setReadinessScore(computeReadinessScore(checkIns).score);
      })
      .catch(() => {
        if (cancelled) setReadinessScore(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeId) ?? null,
    [sessions, activeId],
  );

  const profile: ChatProfile = useMemo(
    () => ({ goalLabel, injuryLabel, providerId, readiness: readinessScore }),
    [goalLabel, injuryLabel, providerId, readinessScore],
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
    <div className="flex h-[calc(100dvh-4rem)] overflow-hidden bg-background md:h-dvh">
      <AiCoachSidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
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
          profile={profile}
          onProviderChange={setProviderId}
          onSend={handleSend}
          onToggleSidebar={handleToggleSidebar}
        />
      </div>
    </div>
  );
}
