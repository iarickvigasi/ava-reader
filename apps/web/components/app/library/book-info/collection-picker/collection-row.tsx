import { useId } from "react";
import type { LibraryCollection } from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { CheckBoldIcon } from "../check-bold-icon";

export function CollectionRow({ collection, checked, disabled, onToggle }: {
  collection: Pick<LibraryCollection, "id" | "name" | "description">;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const descriptionId = useId();
  return (
    <label className={cn(
      "flex min-h-16 cursor-pointer items-center gap-4 rounded-control px-4 py-3 transition duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-line-strong",
      checked ? "bg-soft-fill" : "bg-paper-strong/70 hover:bg-paper-strong",
      disabled && "pointer-events-none opacity-55",
    )}>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-lg font-medium leading-6 text-title">
          {collection.name}
        </span>
        {collection.description ? (
          <span id={descriptionId} className="mt-1 line-clamp-2 break-words text-sm leading-5 text-copy">
            {collection.description}
          </span>
        ) : null}
      </span>
      <input
        type="checkbox"
        className="peer sr-only"
        aria-label={collection.name}
        aria-describedby={collection.description ? descriptionId : undefined}
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
      />
      <span aria-hidden className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full transition duration-200",
        checked ? "bg-brand-fill text-brand-foreground" : "bg-ink/10 text-transparent",
      )}>
        <CheckBoldIcon className="size-3.5" />
      </span>
    </label>
  );
}
