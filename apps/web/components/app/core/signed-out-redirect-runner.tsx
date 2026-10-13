"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useNetworkState } from "@/features/offline/net/use-network-state";
import { getActiveUserId } from "@/features/offline/db";
import { shouldRedirectToSignIn } from "./signed-out-redirect-action";
import { reportReturnTarget } from "@/features/admin/pdf-reports/auth-return";
import { REPORT_ROUTE } from "@/features/admin/pdf-reports/query";

export function SignedOutRedirectRunner() {
  const { isLoaded, isSignedIn } = useAuth();
  const online = useNetworkState();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams()?.toString();
  const target =
    pathname === REPORT_ROUTE && search !== undefined
      ? reportReturnTarget(`${pathname}${search ? `?${search}` : ""}`)
      : "/app";
  const signInHref =
    target === "/app"
      ? "/sign-in"
      : `/sign-in?redirect_url=${encodeURIComponent(target)}`;
  useEffect(() => {
    if (
      shouldRedirectToSignIn({
        online,
        isLoaded,
        isSignedIn,
        hasLocalAccount: !!getActiveUserId(),
      })
    )
      router.replace(signInHref);
  }, [online, isLoaded, isSignedIn, router, pathname, search, signInHref]);
  return null;
}
