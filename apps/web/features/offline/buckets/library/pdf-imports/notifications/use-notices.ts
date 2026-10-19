"use client";
import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { getDb, type AvaReaderDB } from "../../../../db";
import { markPdfNotice, readPdfNotices } from "./storage";
import type { PdfNoticeView } from "./types";

export function usePdfNotices() {
  const { userId, isLoaded, isSignedIn } = useOfflineAuth();
  const [snapshot, setSnapshot] = useState<{
    db: AvaReaderDB;
    notices: PdfNoticeView[];
  } | null>(null);
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const db = getDb();
    const sub = liveQuery(() => readPdfNotices(db)).subscribe({
      next: (notices) => {
        if (db === getDb()) setSnapshot({ db, notices });
      },
    });
    return () => sub.unsubscribe();
  }, [isLoaded, isSignedIn, userId]);
  const current =
    isLoaded && isSignedIn && snapshot?.db === getDb() ? snapshot : null;
  return {
    notices: current?.notices ?? [],
    mark: (id: string, action: "delivered" | "acknowledged") =>
      current ? markPdfNotice(current.db, id, action) : Promise.resolve(),
  };
}
