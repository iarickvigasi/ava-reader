"use client";

import type { HomePayload } from "@/lib/api-types";
import { useHomeWithCache } from "@/features/offline/buckets/home/hooks";
import { CollectionsPanel } from "./collections-panel";

export function HomeCollectionsWithCache({ home }: { home: HomePayload }) {
  const effective = useHomeWithCache(home) ?? home;
  return <CollectionsPanel collections={effective.collections.items} />;
}
