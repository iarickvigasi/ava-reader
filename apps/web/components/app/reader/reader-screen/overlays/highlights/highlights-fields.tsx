import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { EditIcon, TrashIcon } from "@/components/app/shared/app-icons";
import { cn } from "@/lib/cn";
import {
  HIGHLIGHT_COLOR_BG,
  type HighlightFilter,
} from "./highlights-data";
import { MoreVerticalIcon } from "./highlights-icons";

export function SearchField({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const t = useTranslations("reader.highlights");
  return (
    <label className="block">
      <span className="sr-only">{t("searchAria")}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("searchPlaceholder")}
        className="block h-9 w-full rounded-lg bg-soft-tone-fill px-3 font-(--font-ui) text-[0.78rem] uppercase tracking-[0.16em] text-muted placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-ink/15"
      />
    </label>
  );
}

export function ColorFilterChip({
  filter,
  isActive,
  onSelect,
}: {
  filter: HighlightFilter;
  isActive: boolean;
  onSelect: () => void;
}) {
  const badgeColor =
    filter.id === "all"
      ? "var(--paper-strong)"
      : HIGHLIGHT_COLOR_BG[filter.id];

  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onSelect}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg pl-2.5 pr-1 transition",
        isActive
          ? "bg-brand-fill text-paper"
          : "bg-soft-tone-fill text-muted hover:bg-soft-tone-fill/80",
      )}
    >
      <span className="font-(--font-ui) text-[0.72rem] uppercase tracking-[0.14em]">
        {filter.label}
      </span>
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-full text-[0.78rem] font-semibold",
          isActive ? "text-ink" : "text-muted",
        )}
        style={{ backgroundColor: badgeColor }}
      >
        {filter.count}
      </span>
    </button>
  );
}

export function RowActionsMenuTrigger({
  ariaLabel,
  isOpen,
  onToggle,
}: {
  ariaLabel: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-ink/55 transition",
        "hover:bg-soft-tone-fill hover:text-ink",
        "opacity-0 group-hover/highlight-row:opacity-100 focus:opacity-100",
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

export function RowActionsMenu({
  onDelete,
  onRename,
}: {
  onDelete?: () => void;
  onRename?: () => void;
}) {
  const t = useTranslations("reader.highlights");
  return (
    <div
      role="menu"
      className="absolute right-2 top-full z-10 mt-1 w-36 rounded-[10px] border border-line/40 bg-paper-strong p-2 shadow-[-6px_6px_18px_rgba(31,27,24,0.10)]"
    >
      <RowActionsMenuItem
        icon={<EditIcon className="size-4" aria-hidden="true" />}
        label={t("rename")}
        tone="default"
        onClick={onRename}
      />
      <RowActionsMenuItem
        icon={<TrashIcon className="size-4" aria-hidden="true" />}
        label={t("delete")}
        tone="danger"
        onClick={onDelete}
      />
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
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left font-(--font-ui) text-[0.72rem] uppercase tracking-[0.16em] transition",
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
