"use client";
import type { HomePayload } from "@/lib/api-types/home";
import { useHomeWithCache } from "@/features/offline/buckets/home";
import { DevelopersSection } from "./developers-section";

export function DevelopersWithCache({ home }: { home: HomePayload }) {
  const current = useHomeWithCache(home);
  return <DevelopersSection developers={current?.developers} />;
}
