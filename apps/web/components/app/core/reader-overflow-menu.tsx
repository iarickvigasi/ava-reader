import { useReaderOverflowMenu } from "@/features/reader/use-reader-overflow-menu";
import { useTranslations } from "next-intl";
import { readerNavItems } from "./reader-navigation-items";
import { useReaderUi } from "./reader-ui-context";

export function ReaderOverflowMenu({
  items,
}: {
  items: (typeof readerNavItems)[number][];
}) {
  const { activePanel, togglePanel, isBilingual, toggleBilingual, isPhone } =
    useReaderUi();
  const t = useTranslations("nav.reader");
  const { id, menuRef, triggerRef, close, onToggle, onKeyDown } =
    useReaderOverflowMenu();
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={id}
        aria-label={t("moreActions")}
        aria-haspopup="menu"
        aria-controls={id}
        aria-expanded={false}
        className={`${isPhone ? "size-8" : "size-9"} shrink-0 rounded-control text-title hover:bg-soft-tone-fill/75 focus-visible:ring-2 focus-visible:ring-line-strong`}
      >
        ⋯
      </button>
      <div
        ref={menuRef}
        id={id}
        popover="auto"
        role="menu"
        aria-label={t("moreActions")}
        className="fixed inset-auto m-0 min-w-48 rounded-control bg-paper-strong p-2 text-copy shadow-(--shadow-soft)"
        onToggle={onToggle}
        onKeyDown={onKeyDown}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            "panel" in item ? activePanel === item.panel : isBilingual;
          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                if ("panel" in item) togglePanel(item.panel);
                else toggleBilingual();
              }}
              className={`flex w-full items-center gap-3 rounded-control px-3 py-2 text-left text-sm hover:bg-soft-tone-fill ${active ? "bg-soft-tone-fill" : ""}`}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {t(item.id)}
              {active && <span className="sr-only"> ✓</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}
