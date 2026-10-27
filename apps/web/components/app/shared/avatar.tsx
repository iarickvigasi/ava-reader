"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export function Avatar({
  src,
  initials,
  className,
  label,
}: {
  src: string | null | undefined;
  initials: string;
  className?: string;
  label?: string;
}) {
  const [loaded, setLoaded] = useState<string | null>(null);
  return (
    <span
      role="img"
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-fill font-semibold uppercase text-brand-foreground",
        className,
      )}
    >
      {initials}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          onLoad={() => setLoaded(src)}
          onError={() => setLoaded(null)}
          className={cn(
            "absolute inset-0 size-full object-cover",
            loaded === src ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </span>
  );
}
