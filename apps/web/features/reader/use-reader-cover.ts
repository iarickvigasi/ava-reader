import { useEffect, useState } from "react";
import {
  readReaderCover,
  readWarmReaderCover,
} from "@/features/offline/buckets/library";
import { slugFromPath } from "@/lib/app-routes";

export function useReaderCover(slug?: string) {
  const currentSlug =
    slug ??
    (typeof window === "undefined"
      ? null
      : slugFromPath(window.location.pathname, "/app/read/"));
  const [resolved, setResolved] = useState<{
    slug: string;
    cover: Awaited<ReturnType<typeof readReaderCover>>;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (currentSlug) {
      void readReaderCover(currentSlug)
        .then((next) => {
          if (!cancelled) setResolved({ slug: currentSlug, cover: next });
        })
        .catch(() => {
          if (!cancelled) setResolved({ slug: currentSlug, cover: null });
        });
    }
    return () => {
      cancelled = true;
    };
  }, [currentSlug]);
  return currentSlug
    ? (readWarmReaderCover(currentSlug) ??
        (resolved?.slug === currentSlug ? resolved.cover : undefined))
    : undefined;
}
