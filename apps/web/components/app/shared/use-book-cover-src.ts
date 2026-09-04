"use client";

import { useState } from "react";

import { useCoverBlobUrl } from "@/features/offline/buckets/book";

type Artwork = { ratio: number; src: string };

// Resolves which src BookCover should render — the network cover, then (given
// a libraryItemId) its offline-saved blob once that fails — and tracks the
// decoded artwork ratio for whichever one is current.
//
// A failure can arrive with no `error` event to catch: offline, the image
// often finishes (0×0) before hydration attaches the listener, so
// `handleRef`'s mount-time `complete` check routes that through the same
// `handleFailure` path as onError — otherwise the browser's broken-image icon
// paints over the BookCoverFallback sitting right behind it.
export function useBookCoverSrc(src: null | string, libraryItemId: null | string) {
  const [measured, setMeasured] = useState<Artwork | null>(null);
  const [failedSrc, setFailedSrc] = useState<null | string>(null);
  const [blobFailed, setBlobFailed] = useState(false);

  const networkFailed = !!src && failedSrc === src;
  const offlineCoverUrl = useCoverBlobUrl(
    networkFailed && !blobFailed ? libraryItemId : null,
  );
  const effectiveSrc = networkFailed
    ? blobFailed
      ? null
      : offlineCoverUrl
    : src;

  const artwork = measured?.src === effectiveSrc ? measured : null;

  const handleFailure = () => {
    if (networkFailed) {
      setBlobFailed(true);
    } else if (src) {
      setFailedSrc(src);
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
