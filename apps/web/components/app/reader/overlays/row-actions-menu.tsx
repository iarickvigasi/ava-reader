import type { ReactNode } from "react";
import { CopyIcon, EditIcon, TrashIcon } from "@/components/app/shared/app-icons";
import { cn } from "@/lib/cn";

type RowActionKind = "rename" | "delete" | "copy";

// Icon + tone are derived centrally from the action kind so every overlay's
// "delete" looks the same red trash item and "rename" the same edit item.
const ACTION_PRESET: Record<
  RowActionKind,
  { tone: "default" | "danger"; renderIcon: () => ReactNode }
> = {
  copy: {
    tone: "default",
    renderIcon: () => <CopyIcon className="size-4" aria-hidden="true" />,
  },
  rename: {
    tone: "default",
    renderIcon: () => <EditIcon className="size-4" aria-hidden="true" />,
  },
  delete: {
    tone: "danger",
    renderIcon: () => <TrashIcon className="size-4" aria-hidden="true" />,
  },
};

export type RowAction = {
  kind: RowActionKind;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
};

export function RowActionsMenu({ actions, placement = "floating", ariaLabel }: {
  actions: RowAction[];
  placement?: "floating" | "popover";
  ariaLabel?: string;
}) {
  return (
    <div
      role="menu"
      aria-label={ariaLabel}
      className={cn(
        "w-36 rounded-control bg-paper-strong p-2 shadow-(--shadow-soft)",
        placement === "floating" && "absolute right-2 top-full z-10 mt-1",
      )}
    >
      {actions.map((action) => {
        const preset = ACTION_PRESET[action.kind];
        return (
          <RowActionsMenuItem
            key={action.kind}
            icon={preset.renderIcon()}
            label={action.label}
            tone={preset.tone}
            onClick={action.onClick}
            disabled={action.disabled}
          />
        );
      })}
    </div>
  );
}

function RowActionsMenuItem({
  icon,
  label,
  onClick,
  disabled,
  tone,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  tone: "default" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left font-ui text-[0.72rem] uppercase tracking-[0.16em] transition",
        "aria-disabled:cursor-not-allowed aria-disabled:opacity-55",
        !disabled && "hover:bg-soft-tone-fill/80",
        tone === "danger" ? "text-danger" : "text-copy",
      )}
    >
      <span className="inline-flex size-5 items-center justify-center">
        {icon}
      </span>
      {label}
    </button>
  );
}
