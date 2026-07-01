"use client";

import { AuthenticateWithRedirectCallback, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

export function SsoCallbackHandler() {
  const router = useRouter();
  const { isLoaded } = useAuth();
  const [message, setMessage] = useState("Finishing Google authentication...");

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const stallTimer = window.setTimeout(() => {
      setMessage(
        "Google authentication is taking longer than expected. Returning you to sign in...",
      );
      window.setTimeout(() => {
        router.replace("/sign-in?notice=oauth_continue");
      }, 1500);
    }, 15000);

    return () => {
      window.clearTimeout(stallTimer);
    };
  }, [isLoaded, router]);

  return (
    <>
      {isLoaded ? (
        <AuthenticateWithRedirectCallback
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          firstFactorUrl="/sign-in?notice=oauth_continue"
          secondFactorUrl="/sign-in?notice=oauth_continue"
          continueSignUpUrl="/sign-up?notice=oauth_requirements"
          signInForceRedirectUrl="/app"
          signUpForceRedirectUrl="/app"
        />
      ) : null}
      <AuthShell title="Just a moment" subtitle={message}>
        <div className="rounded-card bg-white/68 px-5 py-8 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-line border-t-ink" />
          <div id="clerk-captcha" />
        </div>
      </AuthShell>
    </>
  );
}
