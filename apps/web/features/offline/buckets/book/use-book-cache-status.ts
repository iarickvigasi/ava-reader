import { useEffect, useState } from "react";
import type { BookSaveStatus } from "./bucket";
import { hasBookContent } from "./storage";

export function useBookCacheStatus(
  libraryItemId: string,
  ownerId: string | null | undefined,
  saveStatus: BookSaveStatus,
): boolean | null {
  const scope = `${ownerId}:${libraryItemId}`;
  const [cache, setCache] = useState<{
    scope: string;
    present: boolean;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void hasBookContent(libraryItemId).then((present) => {
      if (!cancelled) setCache({ scope, present });
    });
    return () => {
      cancelled = true;
    };
  }, [libraryItemId, scope, saveStatus]);
  return cache?.scope === scope ? cache.present : null;
}
