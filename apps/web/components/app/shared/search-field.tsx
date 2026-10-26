import "./search-field.css";
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
        className="app-search-field block h-9 w-full rounded-control bg-soft-tone-fill px-3 font-ui text-[0.78rem] uppercase tracking-[0.16em] text-muted outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-inset focus:ring-muted/60"
      />
    </label>
  );
}
