"use client";
import { useEffect, useState } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import type { ReadingReview } from "@/lib/api-types/reading-review";
import { adminRequest } from "./admin-request";

export function useAdminCopies(workId: string) {
  const { getToken } = useOfflineAuth();
  const [entries, setEntries] = useState<ReadingReview[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void adminRequest<ReadingReview[]>(
      `works/${workId}/reviews`,
      getToken,
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setEntries(data);
          setError("");
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load reading copies",
          );
      });
    return () => controller.abort();
  }, [workId, getToken, attempt]);
  const pending = entries?.some(
    (entry) =>
      entry.syncPending ||
      entry.processingStatus === "PENDING" ||
      entry.processingStatus === "PROCESSING",
  );
  useEffect(() => {
    const refresh = () => setAttempt((value) => value + 1);
    window.addEventListener("ava:catalog-updated", refresh);
    const timer = pending ? setInterval(refresh, 10_000) : null;
    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener("ava:catalog-updated", refresh);
    };
  }, [pending]);
  return { entries, error };
}
