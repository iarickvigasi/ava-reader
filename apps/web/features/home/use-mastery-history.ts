"use client";

import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import { liveQuery } from "dexie";
import { useEffect, useRef, useState } from "react";
import { fetchMasteryHistory } from "./fetch-mastery-history";
import { useHistoryRecovery } from "./use-history-recovery";
import { getDb, type SessionRow } from "@/features/offline/db";
import { composeHistory } from "./compose-history";
import type { MasteryHistoryPage } from "./types";

export function useMasteryHistory(firstDay: string, goal: number) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [pages, setPages] = useState<MasteryHistoryPage[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const subscription = liveQuery(() => getDb().sessions.toArray()).subscribe(
      setSessions,
    );
    return () => {
      subscription.unsubscribe();
      controller.current?.abort();
      controller.current = null;
    };
  }, []);
  const before = pages[0]?.nextBefore ?? (pages.length ? null : firstDay);
  const hasLocalHistory =
    !!before ||
    sessions.some(
      (row) =>
        row.state === "closed" &&
        !!row.endedAt &&
        row.replayStatus !== "dropped" &&
        row.startedAt.slice(0, 10) < (pages[0]?.days[0].key ?? firstDay),
    );
  async function load() {
    if (pending.current || !hasLocalHistory) return;
    pending.current = true;
    setStatus("loading");
    const request = new AbortController();
    controller.current = request;
    try {
      const page = await fetchMasteryHistory(
        before ?? pages[0].days[0].key,
        getToken,
        request,
      );
      if (controller.current !== request) return;
      setPages((current) => [page, ...current]);
      setStatus("idle");
    } catch {
      if (controller.current === request) setStatus("error");
    } finally {
      pending.current = false;
    }
  }
  useHistoryRecovery(status, !!(isLoaded && isSignedIn), load);
  return {
    days: pages
      .flatMap((page) => composeHistory(page, sessions, goal))
      .filter((day) => day.key < firstDay),
    status,
    load,
    hasMore: hasLocalHistory,
  };
}
