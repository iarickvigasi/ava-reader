"use client";

// Render-less island: redirects a signed-out user to the local sign-in page
// (10-auth spec, Behaviour 4). The middleware deliberately passes any
// `__session*` cookie holder through so offline reloads keep working — which
// means an *online* user with an expired session would otherwise land on a
// tokenless SSR render. Only the client knows whether it's really online,
// so the redirect lives here:
// offline, clerk-js never loads/confirms signed-out and the guard stays inert.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { useNetworkState } from "@/features/offline/net/use-network-state";

import { shouldRedirectToSignIn } from "./signed-out-redirect-action";

export function SignedOutRedirectRunner() {
  const { isLoaded, isSignedIn } = useAuth();
  const online = useNetworkState();
  const router = useRouter();

  useEffect(() => {
    if (shouldRedirectToSignIn({ online, isLoaded, isSignedIn })) {
      // replace, not push — the tokenless shell render must not stay in
      // history behind the sign-in page. The sign-in flow lands on /app.
      router.replace("/sign-in");
    }
  }, [online, isLoaded, isSignedIn, router]);

  return null;
}
