"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppHeaderBrand } from "@/components/brand/app-header-brand";
import { HeaderStatusChip } from "@/components/app/core/header-status-chip";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import {
  ChartIcon,
  ExploreIcon,
  HomeIcon,
  ReaderLibraryIcon,
} from "@/components/app/shared/app-icons";
import { UserMenuButton } from "@/components/auth/clerk-user-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { CurrentUserPayload } from "@/lib/api-types";
import { isAppNavigationItemActive } from "@/lib/app-navigation";
import { cn } from "@/lib/cn";

import { readerNavItems, readerUtilityItems } from "./reader-navigation-items";
import { ReaderNavItem } from "./reader-nav-item";
import { ReaderMobileNavigation } from "./reader-mobile-navigation";

const items = [
  { href: "/app", id: "home", icon: HomeIcon },
  { href: "/app/library", id: "library", icon: ReaderLibraryIcon },
  { href: "/app/explore", id: "explore", icon: ExploreIcon },
  { href: "/app/insights", id: "insights", icon: ChartIcon },
] as const;

type AppNavigationProps = {
  // Nullable to cover the offline cold-start window: if the app is opened
  // offline and Dexie has no cached user yet, we still render the nav shell
  // (brand, links, theme/offline controls) with the admin entry + display
  // name hidden until a user is available.
  currentUser: CurrentUserPayload | null;
};

export function AppNavigation({ currentUser }: AppNavigationProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const isReaderRoute = pathname.startsWith("/app/read/");
  const isAdmin = currentUser?.role === "ADMIN";

  if (isReaderRoute) {
    return <ReaderNavigation />;
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-paper/92 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
          {/* Equal side tracks keep the brand centered regardless of status or admin controls. */}
          <div className="grid h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 md:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <div className="shrink-0">
                <ThemeToggle />
              </div>
              <HeaderStatusChip compact />
            </div>
            <Link href="/app" className="min-w-0">
              <AppHeaderBrand className="justify-center gap-2" />
            </Link>
            <div className="flex min-w-0 items-center justify-end gap-2">
              {isAdmin ? (
                <Link
                  href="/app/admin/catalog"
                  className="inline-flex min-h-10 min-w-0 items-center rounded-control bg-soft-fill px-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink transition hover:bg-soft-tone-fill"
                  title={t("admin.long")}
                >
                  <span className="truncate">{t("admin.short")}</span>
                </Link>
              ) : null}
              <div className="flex size-8 shrink-0 items-center justify-center">
                <UserMenuButton currentUser={currentUser} />
              </div>
            </div>
          </div>

          <div className="hidden h-20 min-w-0 items-center gap-4 md:flex xl:gap-6">
            <Link href="/app" className="shrink-0">
              <AppHeaderBrand />
            </Link>

            <nav className="flex min-w-0 flex-1 items-center justify-center gap-4 lg:gap-6 xl:gap-8">
              {items.map((item) => {
                const isActive = isAppNavigationItemActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "min-w-0 truncate border-b-2 border-transparent pb-1 text-base uppercase tracking-[0.08em] text-plum/75 transition hover:text-title lg:text-lg xl:text-xl",
                      isActive && "border-title font-medium text-title",
                    )}
                  >
                    {t(`main.${item.id}`)}
                  </Link>
                );
              })}
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              {isAdmin ? (
                <Link
                  href="/app/admin/catalog"
                  className="inline-flex min-h-11 max-w-20 items-center rounded-control bg-white/60 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink transition hover:bg-white"
                  title={t("admin.long")}
                >
                  <span className="truncate">{t("admin.short")}</span>
                </Link>
              ) : null}
              <div className="flex w-9 shrink-0 items-center lg:w-24">
                <HeaderStatusChip compact />
              </div>
              <ThemeToggle />
              <div className="flex items-center gap-2 rounded-2xl bg-soft-fill py-2 xl:px-3">
                <div className="hidden w-24 min-w-0 text-right xl:block">
                  <p
                    className="truncate text-sm font-semibold text-copy-strong"
                    title={currentUser?.displayName ?? t("userFallbackName")}
                  >
                    {currentUser?.displayName ?? t("userFallbackName")}
                  </p>
                </div>
                <div className="flex size-8 shrink-0 items-center justify-center">
                  <UserMenuButton currentUser={currentUser} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 bg-paper/96 backdrop-blur md:hidden">
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
                <span>{t(`main.${item.id}`)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export function ReaderNavigation() {
  const { activePanel, togglePanel, isPhone } = useReaderUi();
  const isLeftPanelOpen =
    activePanel === "contents" ||
    activePanel === "preferences" ||
    activePanel === "ai-chats" ||
    activePanel === "highlights" ||
    activePanel === "ai-comments";

  return (
    <>
      <aside
        className={cn(
          "group/reader-nav fixed inset-y-0 left-0 z-40 hidden overflow-hidden transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          !isPhone && "md:flex",
          isLeftPanelOpen ? "w-94" : "w-20 hover:w-56 focus-within:w-56",
        )}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-full bg-linear-to-r from-paper-strong/88 via-paper/76 to-paper/0 backdrop-blur-[7px] transition-opacity duration-400 ease-out",
            isLeftPanelOpen
              ? "opacity-100 shadow-none"
              : "opacity-0 shadow-[10px_0_40px_0_rgba(31,27,24,0.05)] group-hover/reader-nav:opacity-100 group-focus-within/reader-nav:opacity-100",
          )}
        />

        <div className="relative z-10 flex h-full w-full flex-col px-4 py-8">
          <div className="relative h-11">
            <a
              href="/app"
              className={cn(
                "absolute inset-x-0 top-0 flex h-8 w-full items-center justify-center overflow-hidden font-display text-[1.25rem] leading-8 text-ink transition-opacity duration-300 ease-out",
                isLeftPanelOpen
                  ? "pointer-events-none opacity-0"
                  : "opacity-100",
              )}
            >
              <span className="min-w-max">AVA</span>
            </a>

            <div
              className={cn(
                "absolute inset-x-0 top-0 flex h-11 items-center justify-center px-1 transition-opacity duration-300 ease-out",
                isLeftPanelOpen
                  ? "opacity-100"
                  : "pointer-events-none opacity-0",
              )}
            >
              <a
                href="/app"
                className="truncate text-center font-display text-[1.25rem] leading-none text-ink"
              >
                AVA
              </a>
            </div>
          </div>

          <div
            className={cn(
              "mt-7 flex min-h-0 flex-1 flex-col transition-[opacity,transform] duration-300 ease-out",
              isLeftPanelOpen
                ? "pointer-events-none -translate-x-3 opacity-0"
                : "translate-x-0 opacity-100",
            )}
          >
            <nav className="flex flex-col gap-3">
              {readerNavItems.map((item) => (
                <ReaderNavItem
                  key={item.id}
                  activePanel={activePanel}
                  item={item}
                  onTogglePanel={togglePanel}
                />
              ))}
            </nav>

            <div className="mt-auto flex translate-y-2 items-center justify-start gap-3 px-2 py-3 opacity-0 transition-all duration-300 group-hover/reader-nav:translate-y-0 group-hover/reader-nav:opacity-100 group-focus-within/reader-nav:translate-y-0 group-focus-within/reader-nav:opacity-100">
              {readerUtilityItems.map((item) => (
                <ReaderUtilityItem key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>
      </aside>

      <ReaderMobileNavigation />
    </>
  );
}

function ReaderUtilityItem({
  item,
}: {
  item: (typeof readerUtilityItems)[number];
}) {
  const t = useTranslations("nav.reader");
  const Icon = item.icon;

  return (
    <button
      type="button"
      aria-label={t(item.id)}
      className="flex size-8 items-center justify-center rounded-lg text-title transition hover:bg-soft-tone-fill/75"
    >
      <Icon aria-hidden="true" className="size-4.5" />
    </button>
  );
}
