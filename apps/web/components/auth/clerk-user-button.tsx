"use client";

// Loads Clerk's own <UserButton> lazily via a plain import() rather than
// next/dynamic: next/dynamic's `loading` option is fixed at module scope and
// can't see per-render props (currentUser), and an import() rejection (e.g.
// offline, blocked chunk) has no error boundary around it and would
// otherwise propagate as a render error, unmounting the header slot instead
// of leaving the fallback in place — see [[4.9-header-avatar]]. Until the
// import resolves (or if it never does), UserAvatarFallback holds the slot at
// a fixed size so the header never shifts.

import { useEffect, useState } from "react";
import type { ComponentType } from "react";

import type { CurrentUserPayload } from "@/lib/api-types/user";

import { UserAvatarFallback } from "./user-avatar-fallback";

type ClerkUserButtonComponent = ComponentType<Record<string, never>>;

export function UserMenuButton({
  currentUser = null,
}: {
  currentUser?: CurrentUserPayload | null;
}) {
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

  if (ClerkButton) {
    return <ClerkButton />;
  }
  return <UserAvatarFallback currentUser={currentUser} />;
}
