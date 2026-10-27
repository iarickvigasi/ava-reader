"use client";

import { useEffect } from "react";
import { Avatar } from "@/components/app/shared/avatar";
import {
  persistAvatarFromNetwork,
  useAvatarBlobUrl,
} from "@/features/offline/buckets/me";
import type { CurrentUserPayload } from "@/lib/api-types/user";

export function UserAvatarFallback({
  currentUser,
  className = "size-8 text-xs",
}: {
  currentUser: CurrentUserPayload | null;
  className?: string;
}) {
  const cached = useAvatarBlobUrl();
  const avatarUrl = currentUser?.avatarUrl ?? null;
  useEffect(() => {
    const refresh = () => {
      if (avatarUrl && cached === null)
        void persistAvatarFromNetwork(avatarUrl);
    };
    refresh();
    window.addEventListener("online", refresh);
    return () => window.removeEventListener("online", refresh);
  }, [avatarUrl, cached]);
  const label = currentUser?.displayName || currentUser?.email;
  return (
    <Avatar
      src={cached === undefined ? null : (cached ?? avatarUrl)}
      initials={label?.trim().charAt(0).toUpperCase() ?? ""}
      label={label}
      className={className}
    />
  );
}
