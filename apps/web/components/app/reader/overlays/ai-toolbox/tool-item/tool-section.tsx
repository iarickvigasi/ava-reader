import type { ReactNode } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
} from "@/components/app/shared/app-icons";
import { cn } from "@/lib/cn";

type ToolSectionProps = {
  icon: ReactNode;
  label: string;
  // "expandable" library-sections show a chevron-down that rotates when open and can
  // reveal children. "link" library-sections (e.g. Ask AI) show a chevron-right and
  // never expand inline — they navigate elsewhere.
  variant?: "expandable" | "link";
  isExpanded?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
};

export function ToolSection({
  icon,
  label,
  variant = "expandable",
  isExpanded = false,
  onToggle,
  children,
}: ToolSectionProps) {
  const isExpandable = variant === "expandable";

  return (
    <section className="overflow-hidden rounded-control bg-soft-tone-fill">
      <button
        type="button"
        aria-expanded={isExpandable ? isExpanded : undefined}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-soft-tone-fill/80"
      >
        <span className="flex items-center gap-3">
          <span className="inline-flex size-4 items-center justify-center text-copy">
            {icon}
          </span>
          <span className="font-ui text-[0.78rem] uppercase tracking-[0.16em] text-copy">
            {label}
          </span>
        </span>
        {isExpandable ? (
          <ChevronDownIcon
            className={cn(
              "size-3.5 text-copy transition-transform duration-200",
              isExpanded ? "rotate-180" : "rotate-0",
            )}
          />
        ) : (
          <ChevronRightIcon className="size-3.5 text-copy" />
        )}
      </button>
      {isExpandable && isExpanded && children ? (
        <div className="px-5 pb-6 pt-1">{children}</div>
      ) : null}
    </section>
  );
}
