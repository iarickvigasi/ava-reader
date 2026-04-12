"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppHeaderBrand } from "@/components/brand/app-header-brand";
import {
  useReaderUi,
  type ReaderPanel,
} from "@/components/app/core/reader-ui-context";
import {
  ChartIcon,
  ExploreIcon,
  FontControlsIcon,
  HomeIcon,
  ReaderDownloadIcon,
  ReaderBookmarksIcon,
  ReaderFavoritesIcon,
  ReaderLibraryIcon,
  ReaderLayoutIcon,
  ReaderListeningIcon,
  ReaderNotesIcon,
  ReaderSaveIcon,
  ReaderSearchIcon,
  ReaderShareIcon,
  ReaderTranslationIcon,
  SparkIcon,
} from "@/components/app/shared/app-icons";
import { UserMenuButton } from "@/components/auth/clerk-user-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { CurrentUserPayload } from "@/lib/api-types";
import { isAppNavigationItemActive } from "@/lib/app-navigation";
import { cn } from "@/lib/cn";

const readerNavItems = [
  {
    href: "",
    icon: ReaderLayoutIcon,
    label: "Contents",
    panel: "contents",
  },
  {
    href: "",
    icon: FontControlsIcon,
    label: "Preferences",
  },
  {
    href: "/app/ai",
    icon: ReaderNotesIcon,
    label: "AI Chats",
  },
  {
    href: "",
    icon: ReaderFavoritesIcon,
    label: "Highlights",
  },
  {
    href: "",
    icon: SparkIcon,
    label: "AI Comments",
  },
  {
    href: "/app/insights",
    icon: ReaderBookmarksIcon,
    label: "Bookmarks",
  },
  {
    href: "/app/explore",
    icon: ReaderSearchIcon,
    label: "Search",
  },
  {
    href: "/app/ai",
    icon: ReaderListeningIcon,
    label: "Listen to Book",
  },
  {
    href: "",
    icon: ReaderTranslationIcon,
    isActive: true,
    label: "Bilingual Mode",
  },
] as const;

const readerUtilityItems = [
  {
    icon: ReaderSaveIcon,
    label: "Save page",
  },
  {
    icon: ReaderShareIcon,
    label: "Share book",
  },
  {
    icon: ReaderDownloadIcon,
    label: "Download book",
  },
] as const;

const items = [
  { href: "/app", label: "Home", icon: HomeIcon },
  { href: "/app/library", label: "Library", icon: ReaderLibraryIcon },
  { href: "/app/explore", label: "Explore", icon: ExploreIcon },
  { href: "/app/insights", label: "Insights", icon: ChartIcon },
] as const;

type AppNavigationProps = {
  currentUser: CurrentUserPayload;
};

export function AppNavigation({ currentUser }: AppNavigationProps) {
  const pathname = usePathname();
  const isReaderRoute = pathname.startsWith("/app/read/");
  void currentUser;

  if (isReaderRoute) {
    return <ReaderNavigation />;
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-paper/92 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
          <div className="flex h-16 items-center justify-between gap-3 md:hidden">
            <ThemeToggle />
            <Link href="/app" className="min-w-0">
              <AppHeaderBrand className="justify-center gap-2" />
            </Link>
            <div className="flex items-center gap-2">
              {currentUser.role === "ADMIN" ? (
                <Link
                  href="/app/admin/catalog"
                  className="inline-flex min-h-10 items-center rounded-pl border border-line px-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink"
                >
                  Admin
                </Link>
              ) : null}
              <UserMenuButton />
            </div>
          </div>

          <div className="hidden h-20 items-center justify-between gap-8 md:flex">
            <Link href="/app">
              <AppHeaderBrand />
            </Link>

          <nav className="flex items-center gap-10">
            {items.map((item) => {
                const isActive = isAppNavigationItemActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "border-b-2 border-transparent pb-1 text-xl uppercase tracking-[0.08em] text-plum/75 transition hover:text-title",
                      isActive && "border-title font-medium text-title",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-3">
              {currentUser.role === "ADMIN" ? (
                <Link
                  href="/app/admin/catalog"
                  className="inline-flex min-h-11 items-center rounded-[14px] border border-line bg-white/60 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-ink transition hover:bg-white"
                >
                  Admin catalog
                </Link>
              ) : null}
              <ThemeToggle />
              <div className="flex items-center gap-3 rounded-2xl bg-soft-fill px-4 py-2">
                <div className="hidden text-right lg:block">
                  <p className="text-sm font-semibold text-copy-strong">
                    {currentUser.displayName ?? "Reader"}
                  </p>
                </div>
                <UserMenuButton />
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-paper/96 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-4 px-3">
          {items.map((item) => {
            const isActive = isAppNavigationItemActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-18 flex-col items-center justify-center gap-1 px-2 pb-3 pt-2 text-[0.62rem] uppercase tracking-[0.14em] text-plum/70 transition",
                  "after:absolute after:left-1/2 after:top-0 after:h-0.5 after:w-8 after:-translate-x-1/2 after:rounded-full after:bg-transparent after:content-['']",
                  isActive && "font-bold text-title after:bg-title",
                  !isActive && "font-medium",
                )}
              >
                <Icon className="size-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function ReaderNavigation() {
  const { activePanel, togglePanel } = useReaderUi();
  const isContentsOpen = activePanel === "contents";

  return (
    <>
      <aside
        className={cn(
          "group/reader-nav fixed inset-y-0 left-0 z-40 hidden overflow-hidden transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:flex",
          isContentsOpen
            ? "w-94"
            : "w-20 hover:w-56 focus-within:w-56",
        )}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-full bg-linear-to-r from-paper-strong/88 via-paper/76 to-paper/0 backdrop-blur-[7px] transition-opacity duration-400 ease-out",
            isContentsOpen
              ? "opacity-100 shadow-none"
              : "opacity-0 shadow-[10px_0_40px_0_rgba(31,27,24,0.05)] group-hover/reader-nav:opacity-100 group-focus-within/reader-nav:opacity-100",
          )}
        />

        <div className="relative z-10 flex h-full w-full flex-col px-4 py-8">
          <div className="relative h-11">
            <a
              href="/app"
              className={cn(
                "absolute inset-x-0 top-0 flex h-8 w-full items-center justify-center overflow-hidden font-(--font-display) text-[1.25rem] leading-8 text-ink transition-opacity duration-300 ease-out",
                isContentsOpen
                  ? "pointer-events-none opacity-0"
                  : "opacity-100",
              )}
            >
              <span className="min-w-max">AVA</span>
            </a>

            <div
              className={cn(
                "absolute inset-x-0 top-0 flex h-11 items-center justify-center px-1 transition-opacity duration-300 ease-out",
                isContentsOpen
                  ? "opacity-100"
                  : "pointer-events-none opacity-0",
              )}
            >
              <a
                href="/app"
                className="truncate text-center font-(--font-display) text-[1.25rem] leading-none text-ink"
              >
                AVA
              </a>
            </div>
          </div>

          <div
            className={cn(
              "mt-7 flex min-h-0 flex-1 flex-col transition-[opacity,transform] duration-300 ease-out",
              isContentsOpen
                ? "pointer-events-none -translate-x-3 opacity-0"
                : "translate-x-0 opacity-100",
            )}
          >
            <nav className="flex flex-col gap-3">
              {readerNavItems.map((item) => (
                <ReaderNavItem
                  key={item.label}
                  activePanel={activePanel}
                  item={item}
                  onTogglePanel={togglePanel}
                />
              ))}
            </nav>

            <div className="mt-auto flex translate-y-2 items-center justify-start gap-3 px-2 py-3 opacity-0 transition-all duration-300 group-hover/reader-nav:translate-y-0 group-hover/reader-nav:opacity-100 group-focus-within/reader-nav:translate-y-0 group-focus-within/reader-nav:opacity-100">
              {readerUtilityItems.map((item) => (
                <ReaderUtilityItem key={item.label} item={item} />
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div className="sticky top-0 z-40 border-b border-line/40 bg-paper/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-4">
          <a
            href="/app"
            className="font-(--font-display) text-xl leading-none text-ink"
          >
            AVA
          </a>
          <div className="flex items-center gap-2 overflow-x-auto">
            {readerNavItems.slice(0, 5).map((item) => (
              <ReaderNavItem
                key={item.label}
                activePanel={activePanel}
                compact
                item={item}
                onTogglePanel={togglePanel}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function ReaderNavItem({
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
  const Icon = item.icon;
  const isPanelItem = "panel" in item;
  const isActive = ("isActive" in item && item.isActive) || (
    isPanelItem && activePanel === item.panel
  );
  const content = (
    <>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center",
          compact ? "size-9" : "h-12 w-12",
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn("shrink-0 text-title opacity-95", compact ? "size-4" : "size-4.5")}
        />
      </span>
      {compact ? (
        <span className="sr-only">{item.label}</span>
      ) : (
        <span className="max-w-0 -translate-x-1 overflow-hidden whitespace-nowrap text-[0.95rem] uppercase tracking-[0.08em] text-title opacity-0 transition-[max-width,opacity,transform] duration-300 group-hover/reader-nav:max-w-36 group-hover/reader-nav:translate-x-0 group-hover/reader-nav:opacity-100 group-focus-within/reader-nav:max-w-36 group-focus-within/reader-nav:translate-x-0 group-focus-within/reader-nav:opacity-100">
          {item.label}
        </span>
      )}
    </>
  );

  const className = cn(
    "flex items-center overflow-hidden rounded-[8px] text-title transition-colors duration-300",
    compact
      ? "size-9 shrink-0 justify-center"
      : "w-full justify-start py-0",
    "hover:bg-soft-tone-fill/75",
    isActive && "bg-soft-tone-fill",
  );

  if (isPanelItem) {
    return (
      <button
        type="button"
        aria-label={item.label}
        aria-pressed={isActive}
        className={className}
        onClick={() => onTogglePanel(item.panel)}
      >
        {content}
      </button>
    );
  }

  if (!item.href) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link aria-label={item.label} className={className} href={item.href}>
      {content}
    </Link>
  );
}

function ReaderUtilityItem({
  item,
}: {
  item: (typeof readerUtilityItems)[number];
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      aria-label={item.label}
      className="flex size-8 items-center justify-center rounded-lg text-title transition hover:bg-soft-tone-fill/75"
    >
      <Icon aria-hidden="true" className="size-4.5" />
    </button>
  );
}
