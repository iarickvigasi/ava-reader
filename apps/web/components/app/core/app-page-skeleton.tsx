"use client";

import { usePathname } from "next/navigation";
import { LibraryScreenSkeleton } from "@/components/app/library/library-screen";
import { LibraryCollectionPlaceholderPage } from "@/components/app/library/collection/collection-placeholder-page";
import { HomeScreenSkeleton } from "@/components/app/home/home-screen-skeleton";
import { BookInfoStartupSkeleton } from "@/components/app/library/book-info/book-info-startup-skeleton";
import { ReaderStartupSkeleton } from "@/components/app/reader/reader-startup-skeleton";
import { ConnectScreenSkeleton } from "@/components/app/connect/connect-screen-skeleton";
import { CatalogAuthorSkeleton } from "@/components/app/explore/catalog-author-skeleton";
import { CatalogBookSkeleton } from "@/components/app/explore/catalog-book-skeleton";
import { ExploreScreenSkeleton } from "@/components/app/explore/explore-screen-skeleton";
import { InsightsScreenSkeleton } from "@/components/app/insights/insights-screen-skeleton";

export function AppPageSkeleton() {
  const pathname = usePathname();
  if (pathname === "/app/library") return <LibraryScreenSkeleton />;
  if (pathname.startsWith("/app/library/collections/"))
    return <LibraryCollectionPlaceholderPage />;
  if (pathname.startsWith("/app/library/books/"))
    return <BookInfoStartupSkeleton />;
  if (pathname.startsWith("/app/read/")) return <ReaderStartupSkeleton />;
  if (pathname === "/app/connect") return <ConnectScreenSkeleton />;
  if (pathname.startsWith("/app/explore/editions/"))
    return <CatalogBookSkeleton />;
  if (pathname.startsWith("/app/explore/books/"))
    return <CatalogBookSkeleton />;
  if (pathname.startsWith("/app/explore/authors/"))
    return <CatalogAuthorSkeleton />;
  if (pathname === "/app/explore") return <ExploreScreenSkeleton />;
  if (pathname === "/app/insights") return <InsightsScreenSkeleton />;
  if (pathname === "/app/admin/catalog" || pathname === "/app/admin/reviews")
    return <ExploreScreenSkeleton />;
  return <HomeScreenSkeleton />;
}
