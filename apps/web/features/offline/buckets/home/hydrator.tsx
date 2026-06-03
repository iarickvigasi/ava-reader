"use client";

import type { HomePayload } from "@/lib/api-types/home";

import { useHydrateHome } from "./hooks";

export function HomeHydrator({
  initial,
}: {
  initial: HomePayload | null;
}) {
  useHydrateHome(initial);
  return null;
}
