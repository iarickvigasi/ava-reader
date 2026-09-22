"use client";

import { cn } from "@/lib/cn";
import { HeaderStatusChip } from "./header-status-chip";
import { ReaderNavItem } from "./reader-nav-item";
import { readerNavItems } from "./reader-navigation-items";
import { useReaderUi } from "./reader-ui-context";

export function ReaderMobileNavigation() {
  const { activePanel, togglePanel, isPhone, isBilingual } = useReaderUi();
  const isLandscapePhone = isPhone && isBilingual;
  const items = readerNavItems.filter(
    (item, index) => index < 5 || (!isPhone && item.id === "bilingualMode"),
  );
  return (
    <header
      data-reader-mobile-navigation={isLandscapePhone ? "rail" : "header"}
      className={cn(
        "z-40 shrink-0 bg-paper/95 backdrop-blur",
        isLandscapePhone
          ? "flex h-full flex-col items-center px-1 py-1"
          : "sticky top-0 px-4 py-2",
        !isPhone && "md:hidden",
      )}
      style={
        isLandscapePhone
          ? {
              width: "calc(2.75rem + env(safe-area-inset-left, 0px))",
              paddingLeft: "calc(0.25rem + env(safe-area-inset-left, 0px))",
              paddingTop: "max(0.25rem, env(safe-area-inset-top, 0px))",
              paddingBottom: "max(0.25rem, env(safe-area-inset-bottom, 0px))",
            }
          : undefined
      }
    >
      <div
        className={cn(
          "flex gap-2",
          isLandscapePhone
            ? "min-h-0 w-full flex-1 flex-col items-center"
            : "items-center justify-between",
        )}
      >
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="/app"
            className={cn(
              "font-display leading-none text-ink",
              isLandscapePhone ? "flex h-7 items-center text-lg" : "text-xl",
            )}
          >
            AVA
          </a>
          {!isLandscapePhone && <HeaderStatusChip compact iconOnly />}
        </div>
        <nav
          className={cn(
            "flex min-w-0",
            isLandscapePhone
              ? "flex-col items-center gap-1"
              : "items-center gap-1 overflow-x-auto sm:gap-2",
          )}
        >
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
        {isLandscapePhone && (
          <HeaderStatusChip compact iconOnly className="mt-auto" />
        )}
      </div>
    </header>
  );
}
