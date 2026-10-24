import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export function SearchField({
  label,
  className,
  ...props
}: ComponentPropsWithoutRef<"input"> & { label: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="sr-only">{label}</span>
      <input
        {...props}
        type="search"
        aria-label={label}
        className="h-10 w-full rounded-control bg-paper-strong/90 px-4 text-[0.82rem] uppercase tracking-[0.14em] text-title outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-line-strong"
      />
    </label>
  );
}
