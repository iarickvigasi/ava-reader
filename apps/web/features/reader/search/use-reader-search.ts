import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { ReaderStatusPayload } from "@/lib/api-types/reader";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { getDb } from "@/features/offline/db";
import { useMountedDeviceOwner } from "@/features/offline/lifecycle/device-owner-context";
import { ownsLocalSearch } from "./ownership";
import { useSearchSource } from "./use-search-source";
import { fetchReaderPayload } from "@/components/app/reader/data/reader-client";
import { loadSearchPassages } from "./load";
import { findBookText } from "./find";
import type { SearchPassage } from "./types";

export function useReaderSearch(
  payload: Extract<ReaderStatusPayload, { status: "READY" }>,
) {
  const { userId, sessionId, getToken, isLoaded, isSignedIn } =
    useOfflineAuth();
  const mountedOwner = useMountedDeviceOwner();
  const [binding] = useState(() => ({
    owner: mountedOwner,
    db: mountedOwner ? getDb() : null,
  }));
  const { source, identity } = useSearchSource(payload);
  const [query, setQuery] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    owner: string;
    identity: string;
    attempt: number;
    passages: SearchPassage[] | null;
    error: boolean;
  } | null>(null);
  const deferredQuery = useDeferredValue(query);
  const eligible = ownsLocalSearch(binding, mountedOwner, userId, sessionId);
  useEffect(() => {
    const controller = new AbortController();
    const owns = () =>
      !controller.signal.aborted &&
      ownsLocalSearch(binding, mountedOwner, userId, sessionId);
    if (!owns()) return () => controller.abort();
    const requestChapter = async (chapterId: string) => {
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
    };
    loadSearchPassages(source, requestChapter, controller.signal).then(
      (passages) => {
        if (owns())
          setState({
            owner: binding.owner!,
            identity,
            attempt,
            passages,
            error: false,
          });
      },
      () => {
        if (owns())
          setState({
            owner: binding.owner!,
            identity,
            attempt,
            passages: null,
            error: true,
          });
      },
    );
    return () => controller.abort();
  }, [
    source,
    identity,
    attempt,
    binding,
    mountedOwner,
    userId,
    sessionId,
    getToken,
    isLoaded,
    isSignedIn,
  ]);
  const current =
    eligible &&
    state !== null &&
    state.owner === binding.owner &&
    state.identity === identity &&
    state.attempt === attempt;
  const ready = current && state.passages !== null;
  const results = useMemo(
    () => findBookText(ready ? state!.passages! : [], deferredQuery),
    [ready, state, deferredQuery],
  );
  return {
    query,
    setQuery,
    results,
    loading: eligible && !current,
    error: !eligible || (current && state.error),
    pending: query !== deferredQuery,
    retry: () => setAttempt((value) => value + 1),
  };
}
