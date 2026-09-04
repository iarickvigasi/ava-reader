"use client";

// Loads Clerk's own <UserButton> lazily via a plain import() rather than
// next/dynamic: next/dynamic's `loading` option is fixed at module scope and
// can't see per-render props (currentUser), and an import() rejection (e.g.
// offline, blocked chunk) has no error boundary around it and would
// otherwise propagate as a render error, unmounting the header slot instead
// of leaving the fallback in place — see [[4.9-header-avatar]].
//
// A resolved import() is not "Clerk is ready": @clerk/nextjs's wrapper
// components are this app's own same-origin JS (already loaded, resolves
// instantly even offline) — the actual clerk-js runtime is fetched
// separately by <ClerkProvider>, from Clerk's own CDN, and offline that
// fetch never completes. <UserButton> mounts fine but renders nothing until
// that finishes, which — swapping on import() alone — permanently hid the
// fallback behind a blank button. `useUser().isLoaded` reflects
// ClerkProvider's own readiness, so gating on it keeps the fallback in place
// until Clerk can actually render something.
import { useEffect, useState } from "react";
import type { ComponentType } from "react";

import { useUser } from "@clerk/nextjs";

import type { CurrentUserPayload } from "@/lib/api-types/user";

import { UserAvatarFallback } from "./user-avatar-fallback";

type ClerkUserButtonComponent = ComponentType<Record<string, never>>;

export function UserMenuButton({
  currentUser = null,
}: {
  currentUser?: CurrentUserPayload | null;
}) {
  const { isLoaded } = useUser();
  const [ClerkButton, setClerkButton] =
    useState<ClerkUserButtonComponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@clerk/nextjs")
      .then((module) => {
        if (!cancelled) {
          setClerkButton(() => module.UserButton);
        }
      })
      .catch(() => {
        // Offline, or the chunk failed to load — stay on the fallback.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (ClerkButton && isLoaded) {
    return <ClerkButton />;
  }
  return <UserAvatarFallback currentUser={currentUser} />;
}
