import { useEffect, useState } from "react";
import { readReaderCover } from "@/features/offline/buckets/library";
import { slugFromPath } from "@/lib/app-routes";

export function useReaderCover(slug?: string) {
  const [cover, setCover] =
    useState<Awaited<ReturnType<typeof readReaderCover>>>(null);
  useEffect(() => {
    let cancelled = false;
    const currentSlug =
      slug ?? slugFromPath(window.location.pathname, "/app/read/");
    if (currentSlug) {
      void readReaderCover(currentSlug)
        .then((next) => {
          if (!cancelled) setCover(next);
        })
        .catch(() => {
          /* Cover metadata must never block content loading. */
        });
    }
    return () => {
      cancelled = true;
    };
  }, [slug]);
  return cover;
}
