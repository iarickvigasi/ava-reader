"use client";

import { useAuth, useSignUp } from "@clerk/nextjs";
import { isLocallySignedOut } from "@/features/auth/local-sign-out";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AuthRouteSwitcher } from "@/components/auth/auth-route-switcher";
import { AuthShell } from "@/components/auth/auth-shell";
import { EmailCodePanel } from "@/components/auth/email-code-panel";
import { getClerkErrorMessage } from "@/components/auth/clerk-error";
import { ProviderList } from "@/components/auth/provider-list";
import { AuthReadinessNotice } from "./auth-readiness-notice";
import { useAuthReadiness } from "@/features/auth/use-auth-readiness";
import { useAuthOperation } from "@/features/auth/use-auth-operation";

type SignUpFlowProps = {
  initialNotice?: string;
};

type Phase = "idle" | "email" | "code";

export function SignUpFlow({ initialNotice }: SignUpFlowProps) {
  const t = useTranslations("auth.signUp");
  const tShared = useTranslations("auth.shared");
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isLoaded, isSignedIn: signedIn, userId, sessionId } = useAuth();
  const isSignedIn = signedIn && !isLocallySignedOut(userId ?? null, sessionId);
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [localMessage, setLocalMessage] = useState<string | undefined>(
    initialNotice,
  );

  const readiness = useAuthReadiness(isLoaded);
  const operation = useAuthOperation(isLoaded, () =>
    setLocalMessage(tShared("readiness.failed")),
  );

  useEffect(() => {
    if (isSignedIn) {
      router.replace("/app");
    }
  }, [isSignedIn, router]);

  if (isSignedIn) {
    return null;
  }

  const finalize = async () => {
    if (!operation.canCall()) return;
    await signUp.finalize({
      navigate: async ({ decorateUrl, session }) => {
        if (!operation.current()) return;
        if (session?.currentTask) {
          setLocalMessage(tShared("errors.sessionTaskRequired"));
          return;
        }

        const targetUrl = decorateUrl("/app");
        router.replace(targetUrl);
      },
    });
  };

  const startGoogle = async () => {
    setLocalMessage(undefined);
    const { error } = await signUp.sso({
      strategy: "oauth_google",
      redirectUrl: "/app",
      redirectCallbackUrl: "/auth/sso-callback",
    });

    if (!operation.current()) return;
    if (error) {
      setLocalMessage(t("errors.googleStartFailed"));
    }
  };

  const requestEmailCode = async () => {
    setLocalMessage(undefined);
    const { error } = await signUp.create({ emailAddress: email });

    if (error || !operation.canCall()) return;

    const result = await signUp.verifications.sendEmailCode();

    if (result.error || !operation.current()) return;

    setPhase("code");
  };

  const verifyEmailCode = async () => {
    setLocalMessage(undefined);
    const { error } = await signUp.verifications.verifyEmailCode({ code });

    if (error || !operation.current()) return;

    if (signUp.status === "complete") {
      await finalize();
      return;
    }

    setLocalMessage(t("errors.incomplete"));
  };

  const resendCode = async () => {
    setLocalMessage(undefined);
    await signUp.verifications.sendEmailCode();
  };

  const errorMessage =
    phase === "code"
      ? getClerkErrorMessage(errors.fields.code, errors, localMessage)
      : getClerkErrorMessage(errors.fields.emailAddress, errors, localMessage);

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        operation.busy ? null : (
          <AuthRouteSwitcher
            prompt={t("switchPrompt")}
            actionLabel={t("switchAction")}
            href="/sign-in"
          />
        )
      }
    >
      <ProviderList
        emailDisabled={operation.busy}
        googleDisabled={
          !isLoaded || operation.busy || fetchStatus === "fetching"
        }
        onEmail={() => {
          if (operation.locked()) return;
          setLocalMessage(undefined);
          setPhase("email");
        }}
        onGoogle={() => void operation.run(startGoogle)}
      />

      <AuthReadinessNotice
        readiness={readiness}
        operation={operation.state}
        error={
          phase === "idle" && errorMessage !== initialNotice
            ? errorMessage
            : undefined
        }
      />

      {phase !== "idle" ? (
        <EmailCodePanel
          mode="sign-up"
          stage={phase === "code" ? "code" : "identifier"}
          email={email}
          code={code}
          busy={operation.state === "pending" || fetchStatus === "fetching"}
          disabled={!isLoaded || operation.busy}
          interactionLocked={operation.busy}
          error={errorMessage}
          notice={
            localMessage && errorMessage !== localMessage
              ? localMessage
              : undefined
          }
          captchaSlot={<div id="clerk-captcha" />}
          onEmailChange={(value) => {
            if (!operation.locked()) setEmail(value);
          }}
          onCodeChange={(value) => {
            if (!operation.locked()) setCode(value);
          }}
          onBack={() => {
            if (operation.locked()) return;
            setLocalMessage(undefined);
            setPhase(phase === "code" ? "email" : "idle");
          }}
          onSubmitIdentifier={() => void operation.run(requestEmailCode)}
          onSubmitCode={() => void operation.run(verifyEmailCode)}
          onResendCode={() => void operation.run(resendCode)}
        />
      ) : initialNotice ? (
        <div className="rounded-card bg-white/68 px-5 py-4 text-left text-sm text-copy">
          {initialNotice}
        </div>
      ) : null}
    </AuthShell>
  );
}
