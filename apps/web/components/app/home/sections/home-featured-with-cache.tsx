"use client";

import type { HomePayload } from "@/lib/api-types";
import { useHomeWithCache } from "@/features/offline/buckets/home/hooks";
import { FeaturedBooksSection } from "./featured-books/featured-books-section";

export function HomeFeaturedWithCache({ home }: { home: HomePayload }) {
  const effective = useHomeWithCache(home) ?? home;
  return <FeaturedBooksSection entries={effective.featuredCatalog.entries} />;
}
