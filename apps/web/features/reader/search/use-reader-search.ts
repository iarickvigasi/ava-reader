import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { ReaderStatusPayload } from "@/lib/api-types/reader";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { getActiveUserId } from "@/features/offline/db";
import { fetchReaderPayload } from "@/components/app/reader/data/reader-client";
import { loadSearchPassages } from "./load";
import { findBookText } from "./find";
import type { SearchPassage } from "./types";

export function useReaderSearch(
  payload: Extract<ReaderStatusPayload, { status: "READY" }>,
) {
  const { userId, getToken, isLoaded, isSignedIn } = useOfflineAuth();
  const [source] = useState(() => payload);
  const [query, setQuery] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    owner: string;
    attempt: number;
    passages: SearchPassage[] | null;
    error: boolean;
  } | null>(null);
  const deferredQuery = useDeferredValue(query);
  useEffect(() => {
    const controller = new AbortController();
    const owns = () =>
      !!userId && !controller.signal.aborted && userId === getActiveUserId();
    if (!owns()) return () => controller.abort();
    loadSearchPassages(
      source,
      async (chapterId) => {
        if (!owns()) throw new Error("Search account changed");
        const next = await fetchReaderPayload({
          libraryItemId: source.book.libraryItemId,
          chapterId,
          getToken,
          isLoaded,
          isSignedIn,
          signal: controller.signal,
        });
        if (!owns()) throw new Error("Search account changed");
        return next;
      },
      controller.signal,
    ).then(
      (passages) => {
        if (owns())
          setState({ owner: userId!, attempt, passages, error: false });
      },
      () => {
        if (owns())
          setState({ owner: userId!, attempt, passages: null, error: true });
      },
    );
    return () => controller.abort();
  }, [source, attempt, userId, getToken, isLoaded, isSignedIn]);
  const current =
    state !== null && state.owner === userId && state.attempt === attempt;
  const ready = current && state.passages !== null;
  const results = useMemo(
    () => findBookText(ready ? state!.passages! : [], deferredQuery),
    [ready, state, deferredQuery],
  );
  return {
    query,
    setQuery,
    results,
    loading: !current,
    error: current && state.error,
    pending: query !== deferredQuery,
    retry: () => setAttempt((value) => value + 1),
  };
}
