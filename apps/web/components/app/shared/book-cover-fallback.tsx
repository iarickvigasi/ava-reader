import { cn } from "@/lib/cn";
import type { CSSProperties } from "react";

// The designed stand-in for a cover we can't paint: no src, or a load failure.
// Sizing, ratio and radius come from the <BookCover> frame — this only fills it.
export function BookCoverFallback({
  className,
  title,
  style,
}: {
  className?: string;
  title: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        "flex items-center justify-center p-4 text-center",
        "bg-paper-strong",
        className,
      )}
    >
      <div className="mx-auto max-w-44">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-olive">
          AVA Reader
        </p>
        <p className="mt-2 line-clamp-5 wrap-anywhere font-display text-lg leading-tight text-title">
          {title}
        </p>
      </div>
    </div>
  );
}
