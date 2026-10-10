"use client";

import { AuthenticateWithRedirectCallback, useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AuthShell } from "./auth-shell";
import { AuthReadinessNotice } from "./auth-readiness-notice";
import { AUTH_TIMEOUT_MS } from "@/features/auth/with-deadline";

export function SsoCallbackHandler() {
  const { isLoaded } = useAuth();
  const t = useTranslations("auth.shared.readiness");
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    // Bound bootstrap and callback UI time. Reload recovers a stalled page.
    const timer = setTimeout(() => setExpired(true), AUTH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <>
      {isLoaded && !expired ? (
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
      <AuthShell title={t("callbackTitle")}>
        <AuthReadinessNotice
          readiness={isLoaded ? "ready" : "loading"}
          operation={expired ? "timed-out" : isLoaded ? "pending" : "idle"}
        />
        <div id="clerk-captcha" />
      </AuthShell>
    </>
  );
}
