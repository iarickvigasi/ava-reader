"use client";

import { cn } from "@/lib/cn";
import { HeaderStatusChip } from "./header-status-chip";
import { ReaderNavItem } from "./reader-nav-item";
import { readerNavItems } from "./reader-navigation-items";
import { useReaderUi } from "./reader-ui-context";

export function ReaderMobileNavigation() {
  const { activePanel, togglePanel, isPhone } = useReaderUi();
  const items = readerNavItems.filter(
    (item, index) => index < 5 || item.id === "bilingualMode",
  );
  return (
    <header
      data-reader-mobile-navigation="header"
      className={cn(
        "sticky top-0 z-40 shrink-0 bg-paper/95 px-2 py-2 backdrop-blur",
        !isPhone && "md:hidden",
      )}
      style={{
        paddingLeft: "max(0.5rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(0.5rem, env(safe-area-inset-right, 0px))",
        paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex shrink-0 items-center gap-2">
          <a href="/app" className="font-display text-xl leading-none text-ink">
            AVA
          </a>
          <HeaderStatusChip compact iconOnly />
        </div>
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-2">
          {items.map((item) => (
            <ReaderNavItem
              key={item.id}
              activePanel={activePanel}
              compact
              item={item}
              onTogglePanel={togglePanel}
            />
          ))}
        </nav>
      </div>
    </header>
  );
}
