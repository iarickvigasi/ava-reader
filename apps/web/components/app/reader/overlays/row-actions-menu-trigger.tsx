import { MoreVerticalIcon } from "@/components/app/shared/app-icons";
import { cn } from "@/lib/cn";

// Reveal-on-hover class per row group. Kept as static literals so Tailwind's
// scanner emits the `group-hover/<group>` rules — they can't be interpolated.
const REVEAL_BY_GROUP = {
  "highlight-row": "group-hover/highlight-row:opacity-100",
  "ai-comment-row": "group-hover/ai-comment-row:opacity-100",
  "ai-chat-row": "group-hover/ai-chat-row:opacity-100",
} as const;

export type RowGroup = keyof typeof REVEAL_BY_GROUP;

export function RowActionsMenuTrigger({
  ariaLabel,
  group,
  isOpen,
  onToggle,
  sizeClass = "size-6",
}: {
  ariaLabel: string;
  group: RowGroup;
  isOpen: boolean;
  onToggle: () => void;
  sizeClass?: string;
}) {
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-ink/55 transition",
        sizeClass,
        "hover:bg-soft-tone-fill hover:text-ink",
        "opacity-0 focus:opacity-100",
        REVEAL_BY_GROUP[group],
        isOpen && "opacity-100 text-ink",
      )}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <MoreVerticalIcon className="size-4" />
    </button>
  );
}
