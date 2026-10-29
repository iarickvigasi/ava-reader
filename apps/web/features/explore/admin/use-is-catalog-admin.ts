"use client";
import { useCurrentUserCached } from "@/features/offline/buckets/me";
import { UserRole } from "@/lib/api-types/user";

export function useIsCatalogAdmin() {
  const user = useCurrentUserCached(null);
  return !!user?.roles.includes(UserRole.ADMIN);
}
