"use client";

import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import type { BookReadingSnapshot } from "@/lib/api-types/reading-coverage";
import { getDb, type SessionRow } from "../db";
import { composeBookReading } from "./compose-book-reading";

export function useComposedBookMinutesRead(
  libraryItemId: string,
  baselineMinutes: number,
  snapshot?: BookReadingSnapshot,
): number {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  useEffect(() => {
    const db = getDb();
    const subscription = liveQuery(() =>
      db.sessions.where("libraryItemId").equals(libraryItemId).toArray(),
    ).subscribe(setSessions);
    return () => subscription.unsubscribe();
  }, [libraryItemId]);
  return composeBookReading(
    baselineMinutes,
    sessions.filter((row) => row.libraryItemId === libraryItemId),
    snapshot,
  );
}
