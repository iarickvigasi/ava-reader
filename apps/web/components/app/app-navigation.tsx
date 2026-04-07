"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { AppHeaderBrand } from "@/components/brand/app-header-brand";
import {
  ChartIcon,
  ExploreIcon,
  HomeIcon,
  SparkIcon,
} from "@/components/app/app-icons";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { CurrentUserPayload } from "@/lib/api-types";
import { cn } from "@/lib/cn";

const readerNavItems = [
  {
    href: "",
    iconAlt: "Reader layout",
    iconSrc: "/icons/reader-nav/reader-layout.svg",
    isActive: true,
    label: "Reader",
  },
  {
    href: "",
    iconAlt: "Font controls",
    iconSrc: "/icons/reader-nav/font-controls.svg",
    label: "Type",
  },
  {
    href: "",
    iconAlt: "Annotations",
    iconSrc: "/icons/reader-nav/annotations.svg",
    label: "Notes",
  },
  {
    href: "/app/explore",
    iconAlt: "Favorites",
    iconSrc: "/icons/reader-nav/favorites.svg",
    label: "Saved",
  },
  {
    href: "/app",
    iconAlt: "Library",
    iconSrc: "/icons/reader-nav/library.svg",
    label: "Library",
  },
  {
    href: "/app/insights",
    iconAlt: "Bookmarks",
    iconSrc: "/icons/reader-nav/bookmarks.svg",
    label: "Bookmarks",
  },
  {
    href: "/app/explore",
    iconAlt: "Search",
    iconSrc: "/icons/reader-nav/search.svg",
    label: "Search",
  },
  {
    href: "/app/ai",
    iconAlt: "Listening",
    iconSrc: "/icons/reader-nav/listening.svg",
    label: "Listen",
  },
  {
    href: "",
    iconAlt: "Translation",
    iconSrc: "/icons/reader-nav/translation.svg",
    label: "Translate",
  },
] as const;

const items = [
  { href: "/app", label: "Home", icon: HomeIcon },
  { href: "/app/explore", label: "Explore", icon: ExploreIcon },
  { href: "/app/ai", label: "AVA AI", icon: SparkIcon },
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
              <UserButton />
            </div>
          </div>

          <div className="hidden h-20 items-center justify-between gap-8 md:flex">
            <Link href="/app">
              <AppHeaderBrand />
            </Link>

            <nav className="flex items-center gap-10">
              {items.map((item) => {
                const isActive =
                  item.href === "/app"
                    ? pathname === "/app"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "border-b-2 border-transparent pb-1 text-xl uppercase tracking-[0.08em] text-plum transition hover:text-ink",
                      isActive && "border-brand-fill text-ink",
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
                <UserButton />
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-paper/96 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-4 px-3">
          {items.map((item) => {
            const isActive =
              item.href === "/app"
                ? pathname === "/app"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-18 flex-col items-center justify-center gap-1 border-t-2 border-transparent text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-plum/70 transition",
                  isActive && "border-brand-fill text-ink",
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
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-22 border-r border-[#efe4dd] bg-[#fbf2ec] shadow-[10px_0_40px_rgba(31,27,24,0.05)] md:flex md:flex-col md:items-center md:py-8">
        <Link
          href="/app"
          className="font-(--font-display) text-[1.25rem] leading-8 text-ink"
        >
          AVA
        </Link>

        <nav className="mt-8 flex flex-col items-center gap-2">
          {readerNavItems.map((item) => (
            <ReaderNavItem key={item.label} item={item} />
          ))}
        </nav>
      </aside>

      <div className="sticky top-0 z-40 border-b border-line/40 bg-paper/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/app"
            className="font-(--font-display) text-xl leading-none text-ink"
          >
            AVA
          </Link>
          <div className="flex items-center gap-2 overflow-x-auto">
            {readerNavItems.slice(0, 5).map((item) => (
              <ReaderNavItem key={item.label} compact item={item} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function ReaderNavItem({
  compact = false,
  item,
}: {
  compact?: boolean;
  item: (typeof readerNavItems)[number];
}) {
  const content = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={item.iconAlt}
        className="h-auto w-auto max-h-5 max-w-5.25 opacity-95"
        src={item.iconSrc}
      />
      <span className="sr-only">{item.label}</span>
    </>
  );

  const className = cn(
    "flex items-center justify-center rounded-[8px] transition hover:bg-white/45",
    compact ? "size-10 shrink-0" : "size-11",
    "isActive" in item && item.isActive && "bg-[#f6ebe5]",
  );

  if (!item.href) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link aria-label={item.label} className={className} href={item.href}>
      {content}
    </Link>
  );
}
