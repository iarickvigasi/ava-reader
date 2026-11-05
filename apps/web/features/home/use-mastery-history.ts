"use client";

import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { getDb, type SessionRow } from "@/features/offline/db";
import { composeHistory } from "./compose-history";
import { useHistoryPages } from "./use-history-pages";

export function useMasteryHistory(firstDay: string, goal: number) {
  const sessions = useHistorySessions();
  const { pages, status, load, hasMore } = useHistoryPages(firstDay, sessions);
  return {
    days: pages
      .flatMap((page) => composeHistory(page, sessions, goal))
      .filter((day) => day.key < firstDay),
    status,
    load,
    hasMore,
  };
}

function useHistorySessions() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  useEffect(() => {
    const subscription = liveQuery(() => getDb().sessions.toArray()).subscribe(
      setSessions,
    );
    return () => subscription.unsubscribe();
  }, []);
  return sessions;
}
