"use client";

// The always-visible avatar slot: what UserMenuButton shows while Clerk's
// interactive <UserButton> is loading, and permanently if it never does
// (offline, blocked chunk) — see [[4.9-header-avatar]]. Fixed size, so the
// header never shifts. Cache-first, lazy-write-through photo, matching
// BookCover's cover-blob pattern (use-book-cover-src.ts): the cached blob
// wins over the network avatarUrl; a cache miss triggers a background fetch
// so the *next* view — even offline — is a cache hit. Either failing falls
// back to the user's initial in a colored circle, never a blank space or the
// browser's broken-image icon.

import { useEffect, useState } from "react";

import {
  persistAvatarFromNetwork,
  useAvatarBlobUrl,
} from "@/features/offline/buckets/me";
import type { CurrentUserPayload } from "@/lib/api-types/user";

export function UserAvatarFallback({
  currentUser,
}: {
  currentUser: CurrentUserPayload | null;
}) {
  const [failedSrc, setFailedSrc] = useState<null | string>(null);

  const cached = useAvatarBlobUrl();
  const avatarUrl = currentUser?.avatarUrl ?? null;
  const stillCheckingCache = cached === undefined;
  const cacheAvailable = typeof cached === "string" && cached !== failedSrc;
  const networkAvailable = !!avatarUrl && avatarUrl !== failedSrc;

  const effectiveSrc = stillCheckingCache
    ? null
    : cacheAvailable
      ? cached
      : networkAvailable
        ? avatarUrl
        : null;

  useEffect(() => {
    if (!avatarUrl || cached !== null) {
      return;
    }
    void persistAvatarFromNetwork(avatarUrl);
  }, [avatarUrl, cached]);

  const label = currentUser?.displayName || currentUser?.email;

  return (
    <div
      aria-label={label}
      className="relative size-8 shrink-0 overflow-hidden rounded-full bg-brand-fill"
      role="img"
    >
      {effectiveSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="size-full object-cover"
          onError={() => setFailedSrc(effectiveSrc)}
          src={effectiveSrc}
        />
      ) : (
        <span className="flex size-full items-center justify-center text-xs font-semibold uppercase text-brand-foreground">
          {initialFor(currentUser)}
        </span>
      )}
    </div>
  );
}

function initialFor(currentUser: CurrentUserPayload | null): string {
  const source = currentUser?.displayName?.trim() || currentUser?.email;
  return source ? source.charAt(0).toUpperCase() : "";
}
