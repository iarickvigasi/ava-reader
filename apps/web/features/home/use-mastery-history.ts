"use client";

import { useAuth } from "@clerk/nextjs";
import { liveQuery } from "dexie";
import { useEffect, useRef, useState } from "react";
import { getPublicApiBaseUrl } from "@/lib/api";
import { getDb, type SessionRow } from "@/features/offline/db";
import { composeHistory } from "./compose-history";
import type { MasteryHistoryPage } from "./types";

export function useMasteryHistory(firstDay: string, goal: number) {
  const { getToken } = useAuth();
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
      if (!navigator.onLine) throw new Error("offline");
      const token = await getToken();
      if (!token) throw new Error("unauthenticated");
      const cursor = before ?? pages[0].days[0].key;
      const response = await fetch(
        `${getPublicApiBaseUrl()}/api/home/mastery?before=${cursor}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: request.signal,
        },
      );
      if (!response.ok) throw new Error("history request failed");
      const page = (await response.json()) as MasteryHistoryPage;
      if (request.signal.aborted) return;
      setPages((current) => [page, ...current]);
      setStatus("idle");
    } catch {
      if (!request.signal.aborted) setStatus("error");
    } finally {
      pending.current = false;
    }
  }
  return {
    days: pages
      .flatMap((page) => composeHistory(page, sessions, goal))
      .filter((day) => day.key < firstDay),
    status,
    load,
    hasMore: hasLocalHistory,
  };
}
