"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useNetworkState } from "@/features/offline/net/use-network-state";
import { getActiveUserId } from "@/features/offline/db";
import { shouldRedirectToSignIn } from "./signed-out-redirect-action";

export function SignedOutRedirectRunner() {
  const { isLoaded, isSignedIn } = useAuth();
  const online = useNetworkState();
  const router = useRouter();
  useEffect(() => {
    if (
      shouldRedirectToSignIn({
        online,
        isLoaded,
        isSignedIn,
        hasLocalAccount: !!getActiveUserId(),
      })
    )
      router.replace("/sign-in");
  }, [online, isLoaded, isSignedIn, router]);
  return null;
}
