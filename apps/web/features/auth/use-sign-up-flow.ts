"use client";
import { useAuth, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getClerkErrorMessage } from "./clerk-error";
import { isLocallySignedOut } from "./local-sign-out";
import { useEmailSignUp } from "./use-email-sign-up";

export function useSignUpFlow(initialNotice?: string) {
  const t = useTranslations("auth.signUp");
  const tShared = useTranslations("auth.shared");
  const { signUp, errors, fetchStatus } = useSignUp();
  const auth = useAuth();
  const signedIn =
    auth.isSignedIn && !isLocallySignedOut(auth.userId ?? null, auth.sessionId);
  const router = useRouter();
  const [message, setMessage] = useState(initialNotice);
  useEffect(() => {
    if (signedIn) router.replace("/app");
  }, [signedIn, router]);
  async function finalize() {
    await signUp.finalize({
      navigate: async ({ decorateUrl, session }) => {
        if (session?.currentTask) {
          setMessage(tShared("errors.sessionTaskRequired"));
          return;
        }
        router.replace(decorateUrl("/app"));
      },
    });
  }
  const email = useEmailSignUp(signUp, finalize, () =>
    setMessage(t("errors.incomplete")),
  );
  async function google() {
    setMessage(undefined);
    const { error } = await signUp.sso({
      strategy: "oauth_google",
      redirectUrl: "/app",
      redirectCallbackUrl: "/auth/sso-callback",
    });
    if (error) setMessage(t("errors.googleStartFailed"));
  }
  const error = getClerkErrorMessage(
    email.phase === "code" ? errors.fields.code : errors.fields.emailAddress,
    errors,
    message,
  );
  const run = (work: () => Promise<void>) => () => {
    setMessage(undefined);
    void work();
  };
  return {
    ...email,
    signedIn,
    message,
    error,
    busy: fetchStatus === "fetching",
    google: () => void google(),
    request: run(email.request),
    verify: run(email.verify),
    resend: run(email.resend),
    openEmail: () => {
      setMessage(undefined);
      email.setPhase("email");
    },
    back: () => {
      setMessage(undefined);
      email.setPhase(email.phase === "code" ? "email" : "idle");
    },
  };
}
