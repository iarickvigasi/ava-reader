"use client";

import { useState } from "react";

import {
  readWarmCover,
  forgetWarmCover,
  rememberCover,
  useCoverBlobUrl,
  useCoverRefresh,
} from "@/features/offline/buckets/book";

type Artwork = { ratio: number; src: string };

// Prefer already decoded artwork, then offline bytes, then the network source.
// Failed warm artwork is evicted so the usual cache/network fallback can recover.
export function useBookCoverSrc(
  src: null | string,
  libraryItemId: null | string,
) {
  const [measured, setMeasured] = useState<Artwork | null>(null);
  const [failedNetworkSrc, setFailedNetworkSrc] = useState<null | string>(null);
  const [failedCacheUrl, setFailedCacheUrl] = useState<null | string>(null);

  const warm = readWarmCover(libraryItemId);
  const cached = useCoverBlobUrl(libraryItemId);
  const stillCheckingCache = cached === undefined;
  const cacheAvailable =
    typeof cached === "string" && cached !== failedCacheUrl;
  const networkFailed = !!src && src === failedNetworkSrc;

  const effectiveSrc =
    warm && warm.src !== failedCacheUrl && warm.src !== failedNetworkSrc
      ? warm.src
      : stillCheckingCache
        ? null
        : cacheAvailable
          ? cached
          : networkFailed
            ? null
            : src;

  useCoverRefresh(libraryItemId, src, cached);

  const artwork =
    measured?.src === effectiveSrc
      ? measured
      : warm?.src === effectiveSrc
        ? warm
        : null;

  const handleFailure = () => {
    if (!effectiveSrc) return;
    if (warm?.src === effectiveSrc) forgetWarmCover(libraryItemId);
    if (effectiveSrc === src) setFailedNetworkSrc(effectiveSrc);
    else setFailedCacheUrl(effectiveSrc);
  };

  const measure = (node: HTMLImageElement) => {
    setMeasured((current) =>
      current?.src === effectiveSrc
        ? current
        : rememberCover(libraryItemId, node, effectiveSrc as string),
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
