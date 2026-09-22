import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { useReaderUi, type ReaderPanel } from "./reader-ui-context";
import { readerNavItems } from "./reader-navigation-items";

export function ReaderNavItem({
  activePanel,
  compact = false,
  item,
  onTogglePanel,
}: {
  activePanel: ReaderPanel | null;
  compact?: boolean;
  item: (typeof readerNavItems)[number];
  onTogglePanel: (panel: ReaderPanel) => void;
}) {
  const t = useTranslations("nav.reader");
  const { isBilingual, isPhone, toggleBilingual } = useReaderUi();
  const compactSize = isPhone && isBilingual ? "size-8" : "size-9";
  const label = t(item.id);
  const Icon = item.icon;
  const isPanelItem = "panel" in item;
  const isActive =
    (item.id === "bilingualMode" && isBilingual) ||
    (isPanelItem && activePanel === item.panel);
  const content = (
    <>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center",
          compact ? compactSize : "h-12 w-12",
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn(
            "shrink-0 text-title opacity-95",
            compact ? "size-4" : "size-4.5",
          )}
        />
      </span>
      {compact ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className="max-w-0 -translate-x-1 overflow-hidden whitespace-nowrap text-[0.95rem] uppercase tracking-[0.08em] text-title opacity-0 transition-[max-width,opacity,transform] duration-300 group-hover/reader-nav:max-w-36 group-hover/reader-nav:translate-x-0 group-hover/reader-nav:opacity-100 group-focus-within/reader-nav:max-w-36 group-focus-within/reader-nav:translate-x-0 group-focus-within/reader-nav:opacity-100">
          {label}
        </span>
      )}
    </>
  );

  const className = cn(
    "flex items-center overflow-hidden rounded-control text-title transition-colors duration-300",
    compact
      ? `${compactSize} shrink-0 justify-center`
      : "w-full justify-start py-0",
    "hover:bg-soft-tone-fill/75",
    isActive && "bg-soft-tone-fill",
  );

  if (isPanelItem) {
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={isActive}
        className={className}
        onClick={() => onTogglePanel(item.panel)}
      >
        {content}
      </button>
    );
  }

  if (item.id === "bilingualMode") {
    return (
      <button
        type="button"
        data-reader-bilingual-toggle
        aria-label={label}
        aria-pressed={isBilingual}
        className={className}
        onClick={toggleBilingual}
      >
        {content}
      </button>
    );
  }

  if (!item.href) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link aria-label={label} className={className} href={item.href}>
      {content}
    </Link>
  );
}
