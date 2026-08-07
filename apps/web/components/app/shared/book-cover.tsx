"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import { BookCoverFallback } from "./book-cover-fallback";

// The single cover primitive — every cover in the app renders through it.
//
// The frame owns ratio and radius (call sites pass width, shadow, margins only)
// and the image is `object-contain`, so a cover whose intrinsic ratio differs
// from the frame is letterboxed on the frame's surface. The previous
// `object-cover` filled the frame instead and sliced the overflow off, which cut
// the top and bottom from any cover taller than its hardcoded per-call-site box.
//
// No state on success: the decoded image paints over the empty frame in the same
// frame as mount, so cached covers never flicker (an opacity-0 → opacity-100
// fade did, when the book-info skeleton swapped to the rendered page). On a load
// *failure* (offline, dead URL) the browser would paint its broken-image icon
// and alt text, so swap in the designed fallback instead.

const RATIO_CLASS = {
  book: "aspect-2/3",
  square: "aspect-square",
} as const;

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
  const [failed, setFailed] = useState(false);

  const frame = cn(
    "overflow-hidden rounded-[3px]",
    RATIO_CLASS[ratio],
    className,
  );

  if (!src || failed) {
    return <BookCoverFallback className={frame} title={title} />;
  }

  return (
    <div className={cn("bg-paper-strong", frame)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={alt}
        className="size-full object-contain"
        onError={() => setFailed(true)}
        src={src}
      />
    </div>
  );
}
