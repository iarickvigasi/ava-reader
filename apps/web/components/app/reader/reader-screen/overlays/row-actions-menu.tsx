import type { ReactNode } from "react";
import { EditIcon, TrashIcon } from "@/components/app/shared/app-icons";
import { cn } from "@/lib/cn";

type RowActionKind = "rename" | "delete";

// Icon + tone are derived centrally from the action kind so every overlay's
// "delete" looks the same red trash item and "rename" the same edit item.
const ACTION_PRESET: Record<
  RowActionKind,
  { tone: "default" | "danger"; renderIcon: () => ReactNode }
> = {
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
};

export function RowActionsMenu({ actions }: { actions: RowAction[] }) {
  return (
    <div
      role="menu"
      className="absolute right-2 top-full z-10 mt-1 w-36 rounded-control bg-paper-strong p-2 shadow-[-6px_6px_18px_rgba(31,27,24,0.10)]"
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
  tone,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  tone: "default" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left font-ui text-[0.72rem] uppercase tracking-[0.16em] transition",
        "hover:bg-soft-tone-fill/80",
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
