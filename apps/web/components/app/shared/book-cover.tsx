"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import { BookCoverFallback } from "./book-cover-fallback";

// The single cover primitive — every cover in the app renders through it.
//
// The frame hugs the artwork: `ratio` only reserves space until the image
// reports its natural size, then the frame adopts that exact ratio. So the
// rounded clip and the shadow trace the cover itself, and there is no
// letterboxing — a fixed frame plus `object-contain` left cream bars around
// off-ratio covers, and the rounded corners were cut into those bars rather
// than into the artwork. (The older `object-cover` had no bars but cropped the
// top and bottom off any cover taller than its box.)
//
// The fallback fills the frame until the image has fully decoded, then
// unmounts. A cached cover neither flashes it nor shifts the layout: the ref
// callback measures during commit, before the browser paints. Both flags are
// tracked per-src, so swapping src (a re-import, a different book in the same
// slot) re-arms the placeholder instead of showing a stale one.

const RATIO_CLASS = {
  audiobook: "aspect-square",
  book: "aspect-2/3",
} as const;

type Artwork = { ratio: number; src: string };

export function BookCover({
  alt,
  className,
  ratio = "book",
  src,
  title,
}: {
  alt: string;
  className?: string;
  ratio?: keyof typeof RATIO_CLASS;
  src: string | null;
  title: string;
}) {
  const [measured, setMeasured] = useState<Artwork | null>(null);
  const [failedSrc, setFailedSrc] = useState<null | string>(null);

  const artwork = measured?.src === src ? measured : null;

  const frame = cn(
    "overflow-hidden rounded-cover",
    !artwork && RATIO_CLASS[ratio],
    className,
  );

  // No src, or the browser would paint its broken-image icon (offline, dead URL).
  if (!src || failedSrc === src) {
    return <BookCoverFallback className={frame} title={title} />;
  }

  const measure = (node: HTMLImageElement) => {
    setMeasured((current) =>
      current?.src === src ? current : toArtwork(node, src),
    );
  };

  return (
    <div
      className={cn("relative bg-paper-strong", frame)}
      style={artwork ? { aspectRatio: artwork.ratio } : undefined}
    >
      {!artwork && (
        <BookCoverFallback className="absolute inset-0 size-full" title={title} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={alt}
        className="relative size-full object-contain"
        onError={() => setFailedSrc(src)}
        onLoad={(event) => measure(event.currentTarget)}
        ref={(node) => {
          if (node?.complete) {
            measure(node);
          }
        }}
        src={src}
      />
    </div>
  );
}

// A decode failure reports 0×0 — keep the reserved ratio rather than collapsing
// the frame; onError swaps in the fallback anyway.
function toArtwork(node: HTMLImageElement, src: string): Artwork | null {
  if (!node.naturalWidth || !node.naturalHeight) {
    return null;
  }
  return { ratio: node.naturalWidth / node.naturalHeight, src };
}
