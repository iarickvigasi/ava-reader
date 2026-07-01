"use client";

// Render-less island that seeds the current-user cache from the layout's
// server fetch. Mounted by the app layout so a later offline reload can
// recover the user from Dexie.

import type { CurrentUserPayload } from "@/lib/api-types/user";

import { useHydrateCurrentUser } from "./hooks";

export function CurrentUserHydrator({
  initial,
}: {
  initial: CurrentUserPayload | null;
}) {
  useHydrateCurrentUser(initial);
  return null;
}
