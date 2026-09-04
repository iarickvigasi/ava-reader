"use client";

import { useEffect, useState } from "react";

import {
  persistCoverFromNetwork,
  useCoverBlobUrl,
} from "@/features/offline/buckets/book";

type Artwork = { ratio: number; src: string };

// Resolves which src BookCover should render, cache-first: the Dexie-cached
// cover (given a libraryItemId) before the network — covers don't change, so
// once one is cached there's no reason to ever refetch it. While the cache
// lookup is unresolved, `effectiveSrc` is null (BookCoverFallback holds the
// frame) rather than racing a network request that cache may make moot.
//
// No id, or the lookup resolves absent → network `src`. A successful network
// view of a personal-library cover (an id and no cached copy yet) is written
// through to Dexie in the background so the *next* view is a cache hit — see
// persistCoverFromNetwork.
//
// A failure — at either layer — can arrive with no `error` event to catch:
// offline, an image often finishes (0×0) before hydration attaches the
// listener, so `handleRef`'s mount-time `complete` check routes that through
// the same `handleFailure` path as onError.
export function useBookCoverSrc(src: null | string, libraryItemId: null | string) {
  const [measured, setMeasured] = useState<Artwork | null>(null);
  const [failedNetworkSrc, setFailedNetworkSrc] = useState<null | string>(null);
  const [failedCacheUrl, setFailedCacheUrl] = useState<null | string>(null);

  const cached = useCoverBlobUrl(libraryItemId);
  const stillCheckingCache = cached === undefined;
  const cacheAvailable = typeof cached === "string" && cached !== failedCacheUrl;
  const networkFailed = !!src && src === failedNetworkSrc;

  const effectiveSrc = stillCheckingCache
    ? null
    : cacheAvailable
      ? cached
      : networkFailed
        ? null
        : src;

  useEffect(() => {
    if (!libraryItemId || !src || cached !== null) {
      return;
    }
    void persistCoverFromNetwork(libraryItemId, src);
  }, [libraryItemId, src, cached]);

  const artwork = measured?.src === effectiveSrc ? measured : null;

  const handleFailure = () => {
    if (cacheAvailable) {
      setFailedCacheUrl(cached);
    } else if (src) {
      setFailedNetworkSrc(src);
    }
  };

  const measure = (node: HTMLImageElement) => {
    setMeasured((current) =>
      current?.src === effectiveSrc
        ? current
        : toArtwork(node, effectiveSrc as string),
    );
  };

  const handleRef = (node: HTMLImageElement | null) => {
    if (!node?.complete) {
      return;
    }
    if (node.naturalWidth === 0 || node.naturalHeight === 0) {
      handleFailure();
    } else {
      measure(node);
    }
  };

  return { artwork, effectiveSrc, handleFailure, handleRef, measure };
}

// A decode failure reports 0×0 — keep the reserved ratio rather than collapsing
// the frame; the caller routes failures to the fallback anyway.
function toArtwork(node: HTMLImageElement, src: string): Artwork | null {
  if (!node.naturalWidth || !node.naturalHeight) {
    return null;
  }
  return { ratio: node.naturalWidth / node.naturalHeight, src };
}
