"use client";

import { useAuth, useClerk, useSignIn } from "@clerk/nextjs";
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
import { startFreshGoogleSignIn } from "@/features/auth/start-fresh-google-sign-in";

type SignInFlowProps = {
  initialNotice?: string;
};

type Phase = "idle" | "email" | "code";

export function SignInFlow({ initialNotice }: SignInFlowProps) {
  const t = useTranslations("auth.signIn");
  const tShared = useTranslations("auth.shared");
  const { signIn, errors, fetchStatus } = useSignIn();
  const clerk = useClerk();
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
    await signIn.finalize({
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
    const started = await startFreshGoogleSignIn(() => clerk.client?.signIn);
    if (!operation.canCall()) return;
    if (!started) setLocalMessage(t("errors.googleStartFailed"));
  };

  const requestEmailCode = async () => {
    setLocalMessage(undefined);
    const { error } = await signIn.create({ identifier: email });

    if (error || !operation.canCall()) return;

    const result = await signIn.emailCode.sendCode();

    if (result.error || !operation.current()) return;

    setPhase("code");
  };

  const verifyEmailCode = async () => {
    setLocalMessage(undefined);
    const { error } = await signIn.emailCode.verifyCode({ code });

    if (error || !operation.current()) return;

    if (signIn.status === "complete") {
      await finalize();
      return;
    }

    if (signIn.status === "needs_second_factor") {
      setLocalMessage(t("errors.needsSecondFactor"));
      return;
    }

    if (signIn.status === "needs_client_trust") {
      setLocalMessage(t("errors.needsClientTrust"));
      return;
    }

    setLocalMessage(t("errors.incomplete"));
  };

  const resendCode = async () => {
    setLocalMessage(undefined);
    await signIn.emailCode.sendCode();
  };

  const errorMessage =
    phase === "code"
      ? getClerkErrorMessage(errors.fields.code, errors, localMessage)
      : getClerkErrorMessage(errors.fields.identifier, errors, localMessage);

  return (
    <AuthShell
      title={t("title")}
      footer={
        operation.busy ? null : (
          <AuthRouteSwitcher
            prompt={t("switchPrompt")}
            actionLabel={t("switchAction")}
            href="/sign-up"
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
          mode="sign-in"
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
