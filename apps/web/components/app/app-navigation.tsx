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
