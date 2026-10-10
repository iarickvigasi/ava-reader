import { useEffect, useState } from "react";
import type { BookSaveStatus } from "./bucket";
import { readBookAvailability } from "./storage";

export function useBookCacheStatus(
  libraryItemId: string,
  ownerId: string | null | undefined,
  saveStatus: BookSaveStatus,
): { complete: boolean; readable: boolean } | null {
  const scope = `${ownerId}:${libraryItemId}`;
  const [cache, setCache] = useState<{
    scope: string;
    complete: boolean;
    readable: boolean;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void readBookAvailability(libraryItemId)
      .then(({ complete, readable }) => {
        if (!cancelled) setCache({ scope, complete, readable });
      })
      .catch(() => {
        if (!cancelled) setCache({ scope, complete: false, readable: false });
      });
    return () => {
      cancelled = true;
    };
  }, [libraryItemId, scope, saveStatus]);
  return cache?.scope === scope ? cache : null;
}
