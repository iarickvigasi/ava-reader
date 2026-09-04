"use client";

import { cn } from "@/lib/cn";
import { BookCoverFallback } from "./book-cover-fallback";
import { useBookCoverSrc } from "./use-book-cover-src";

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
// callback measures during commit, before the browser paints.
//
// `libraryItemId` (see use-book-cover-src.ts) lets a failed network cover
// fall back to the offline-saved blob before giving up on the fallback.

const RATIO_CLASS = {
  audiobook: "aspect-square",
  book: "aspect-2/3",
} as const;

export function BookCover({
  alt,
  className,
  libraryItemId = null,
  ratio = "book",
  src,
  title,
}: {
  alt: string;
  className?: string;
  libraryItemId?: null | string;
  ratio?: keyof typeof RATIO_CLASS;
  src: string | null;
  title: string;
}) {
  const { artwork, effectiveSrc, handleFailure, handleRef, measure } =
    useBookCoverSrc(src, libraryItemId);

  const frame = cn(
    "overflow-hidden rounded-cover",
    !artwork && RATIO_CLASS[ratio],
    className,
  );

  // No src, or every source we know (network, then the offline-saved blob)
  // has failed — the browser would otherwise paint its broken-image icon.
  if (!effectiveSrc) {
    return <BookCoverFallback className={frame} title={title} />;
  }

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
        onError={handleFailure}
        onLoad={(event) => measure(event.currentTarget)}
        ref={handleRef}
        src={effectiveSrc}
      />
    </div>
  );
}
