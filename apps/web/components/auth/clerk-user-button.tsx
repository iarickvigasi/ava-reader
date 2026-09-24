"use client";

import { useClerk } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui/button";
import type { CurrentUserPayload } from "@/lib/api-types/user";
import { useLocalSignOut } from "@/features/auth/use-local-sign-out";
import { UserAvatarFallback } from "./user-avatar-fallback";

// App-owned sign-out distinguishes explicit intent from provider session loss.
// A native details menu remains usable when Clerk's CDN is unavailable.
export function UserMenuButton({
  currentUser = null,
}: {
  currentUser?: CurrentUserPayload | null;
}) {
  const clerk = useClerk();
  const t = useTranslations("auth.device");
  const { signOut, busy, error } = useLocalSignOut();
  return (
    <details className="relative">
      <summary
        aria-label={t("menu")}
        className="cursor-pointer list-none rounded-full [&::-webkit-details-marker]:hidden"
      >
        <UserAvatarFallback currentUser={currentUser} />
      </summary>
      <div className="absolute right-0 z-50 mt-3 grid min-w-52 gap-2 rounded-card bg-paper p-3 shadow-(--shadow-card)">
        {clerk.loaded && clerk.user ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clerk.openUserProfile()}
          >
            {t("manage")}
          </Button>
        ) : (
          <ButtonLink href="/sign-in" variant="ghost" size="sm">
            {t("signIn")}
          </ButtonLink>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void signOut()}
        >
          {t("signOut")}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {t("signOutError")}
          </p>
        )}
      </div>
    </details>
  );
}
