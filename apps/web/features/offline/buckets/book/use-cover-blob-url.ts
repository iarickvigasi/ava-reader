"use client";

import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { readCoverBlob } from "./covers/read";
import { forgetWarmCover, readWarmCover, releaseCoverUrl } from "./warm-cover";

// undefined = resolving, null = absent. Subscribe only to cover bytes so
// metadata refreshes cannot reload artwork. ID/cancellation fences late reads.
export function useCoverBlobUrl(id: string | null): string | null | undefined {
  const [resolved, setResolved] = useState<{
    id: string;
    url: string | null;
  } | null>(null);
  useEffect(() => {
    if (!id) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    let firstRead = true;
    const subscription = liveQuery(() => readCoverBlob(id)).subscribe({
      next: (blob) => {
        if (cancelled) return;
        const warm = firstRead ? readWarmCover(id) : null;
        firstRead = false;
        if (warm) {
          setResolved({ id, url: warm.src });
          return;
        }
        if (objectUrl) releaseCoverUrl(objectUrl);
        forgetWarmCover(id);
        objectUrl = blob ? URL.createObjectURL(blob) : null;
        setResolved({ id, url: objectUrl });
      },
      error: () => {
        if (!cancelled) setResolved({ id, url: null });
      },
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
      if (objectUrl) releaseCoverUrl(objectUrl);
    };
  }, [id]);
  return !id ? null : resolved?.id === id ? resolved.url : undefined;
}
