"use client";

import { AuthenticateWithRedirectCallback, useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AuthShell } from "./auth-shell";
import { AuthReadinessNotice } from "./auth-readiness-notice";
import { AUTH_TIMEOUT_MS } from "@/features/auth/with-deadline";

import { reportReturnTarget } from "@/features/admin/pdf-reports/auth-return";

export function SsoCallbackHandler({ returnTo }: { returnTo?: string } = {}) {
  const target = reportReturnTarget(returnTo);
  const returnQuery =
    target === "/app" ? "" : `redirect_url=${encodeURIComponent(target)}`;
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
          signInUrl={returnQuery ? `/sign-in?${returnQuery}` : "/sign-in"}
          signUpUrl="/sign-up"
          firstFactorUrl={`/sign-in?notice=oauth_continue${returnQuery ? `&${returnQuery}` : ""}`}
          secondFactorUrl={`/sign-in?notice=oauth_continue${returnQuery ? `&${returnQuery}` : ""}`}
          continueSignUpUrl="/sign-up?notice=oauth_requirements"
          signInForceRedirectUrl={target}
          signUpForceRedirectUrl={target}
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
