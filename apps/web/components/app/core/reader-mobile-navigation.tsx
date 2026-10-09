"use client";

import { useToolbarOverflow } from "@/features/reader/use-toolbar-overflow";
import { ReaderOverflowMenu } from "./reader-overflow-menu";
import { cn } from "@/lib/cn";
import { HeaderStatusChip } from "./header-status-chip";
import { ReaderNavItem } from "./reader-nav-item";
import { readerNavItems } from "./reader-navigation-items";
import { useReaderUi } from "./reader-ui-context";
import { ReaderDownloadButton } from "./reader-download-button";

export function ReaderMobileNavigation() {
  const { activePanel, togglePanel, isPhone } = useReaderUi();
  const items = readerNavItems.filter(
    (item, index) =>
      index < 5 || item.id === "search" || item.id === "bilingualMode",
  );
  const { navRef, measureRef, visibleIds } = useToolbarOverflow(
    items.map((item) => item.id),
  );
  const hiddenItems = items.filter((item) => !visibleIds.includes(item.id));
  return (
    <header
      data-reader-mobile-navigation="header"
      className={cn(
        "sticky top-0 z-40 shrink-0 bg-paper/95 pl-4 pr-2 py-2 backdrop-blur",
        !isPhone && "md:hidden",
      )}
      style={{
        paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(0.5rem, env(safe-area-inset-right, 0px))",
        paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))",
      }}
    >
      <div className="flex min-h-9 items-center justify-between gap-2">
        <div className="flex shrink-0 items-center gap-2">
          <a href="/app" className="font-display text-xl leading-none text-ink">
            AVA
          </a>
          <HeaderStatusChip reader compact />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
          <nav
            ref={navRef}
            className="relative flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2"
          >
            {items
              .filter((item) => visibleIds.includes(item.id))
              .map((item) => (
                <ReaderNavItem
                  key={item.id}
                  activePanel={activePanel}
                  compact
                  item={item}
                  onTogglePanel={togglePanel}
                />
              ))}
            {hiddenItems.length > 0 && <ReaderOverflowMenu items={hiddenItems} />}
            <div
              ref={measureRef}
              aria-hidden="true"
              inert
              className="invisible absolute flex w-max gap-1 sm:gap-2"
            >
              {items.map((item) => (
                <span
                  key={item.id}
                  className={isPhone ? "size-8 shrink-0" : "size-9 shrink-0"}
                />
              ))}
              <span className={isPhone ? "size-8 shrink-0" : "size-9 shrink-0"} />
            </div>
          </nav>
          <ReaderDownloadButton />
        </div>
      </div>
    </header>
  );
}
