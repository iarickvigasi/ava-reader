"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export function BookCover({
  alt,
  className,
  src,
  title,
}: {
  alt: string;
  className?: string;
  src: string | null;
  title: string;
}) {
  const [loaded, setLoaded] = useState(false);

  if (!src) {
    return <BookCoverFallback className={className} title={title} />;
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border border-line/40 bg-white/60",
        className,
      )}
    >
      <BookCoverFallback
        className="absolute inset-0 size-full rounded-none border-0"
        title={title}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={alt}
        className={cn(
          "relative size-full object-cover transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0",
        )}
        onLoad={() => setLoaded(true)}
        src={src}
      />
    </div>
  );
}

function BookCoverFallback({
  className,
  title,
}: {
  className?: string;
  title: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-md border border-line/40 bg-soft-fill p-4 text-center",
        className,
      )}
    >
      <div className="mx-auto max-w-44">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-olive">
          AVA Reader
        </p>
        <p className="mt-2 font-display text-2xl leading-tight text-title">
          {title}
        </p>
      </div>
    </div>
  );
}
