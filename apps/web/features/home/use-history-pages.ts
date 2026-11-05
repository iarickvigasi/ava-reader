"use client";

import { mergeHistoryPage } from "./merge-history-page";

import { dayKey } from "@/features/offline/stats/reading-days";

import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import { useEffect, useRef, useState } from "react";
import { fetchMasteryHistory } from "./fetch-mastery-history";
import { useHistoryRecovery } from "./use-history-recovery";
import type { SessionRow } from "@/features/offline/db";
import type { MasteryHistoryPage } from "./types";

export function useHistoryPages(firstDay: string, sessions: SessionRow[]) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [pages, setPages] = useState<MasteryHistoryPage[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [],
  );
  const { before, hasMore } = historyPageCursor(firstDay, pages, sessions);
  async function load() {
    if (pending.current || !hasMore) return;
    pending.current = true;
    setStatus("loading");
    const request = new AbortController();
    controller.current = request;
    try {
      const page = await fetchMasteryHistory(before, getToken, request);
      if (controller.current !== request) return;
      setPages((current) => mergeHistoryPage(current, page));
      setStatus("idle");
    } catch {
      if (controller.current === request) setStatus("error");
    } finally {
      pending.current = false;
    }
  }
  useHistoryRecovery(status, !!(isLoaded && isSignedIn), load);
  return { pages, status, load, hasMore };
}

function historyPageCursor(
  firstDay: string,
  pages: MasteryHistoryPage[],
  sessions: SessionRow[],
) {
  const before = pages[0]?.nextBefore ?? (pages.length ? null : firstDay);
  const earliestDay = pages[0]?.days[0].key ?? firstDay;
  const hasMore =
    !!before ||
    sessions.some(
      (row) =>
        row.state === "closed" &&
        !!row.endedAt &&
        !row.dropped &&
        dayKey(new Date(row.startedAt), row.timeZone) < earliestDay,
    );
  return { before: before ?? earliestDay, hasMore };
}
