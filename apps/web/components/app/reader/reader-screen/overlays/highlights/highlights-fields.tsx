import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import {
  HIGHLIGHT_COLOR_BG,
  type HighlightFilter,
} from "./highlights-data";

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
