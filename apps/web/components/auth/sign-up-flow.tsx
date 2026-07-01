"use client";

import { useAuth, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AuthRouteSwitcher } from "@/components/auth/auth-route-switcher";
import { AuthShell } from "@/components/auth/auth-shell";
import { EmailCodePanel } from "@/components/auth/email-code-panel";
import { getClerkErrorMessage } from "@/components/auth/clerk-error";
import { ProviderList } from "@/components/auth/provider-list";

type SignUpFlowProps = {
  initialNotice?: string;
};

type Phase = "idle" | "email" | "code";

export function SignUpFlow({ initialNotice }: SignUpFlowProps) {
  const t = useTranslations("auth.signUp");
  const tShared = useTranslations("auth.shared");
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [localMessage, setLocalMessage] = useState<string | undefined>(
    initialNotice,
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
    await signUp.finalize({
      navigate: async ({ decorateUrl, session }) => {
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

    if (error) {
      setLocalMessage(t("errors.googleStartFailed"));
    }
  };

  const requestEmailCode = async () => {
    setLocalMessage(undefined);
    const { error } = await signUp.create({ emailAddress: email });

    if (error) {
      return;
    }

    const result = await signUp.verifications.sendEmailCode();

    if (result.error) {
      return;
    }

    setPhase("code");
  };

  const verifyEmailCode = async () => {
    setLocalMessage(undefined);
    const { error } = await signUp.verifications.verifyEmailCode({ code });

    if (error) {
      return;
    }

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
        <AuthRouteSwitcher
          prompt={t("switchPrompt")}
          actionLabel={t("switchAction")}
          href="/sign-in"
        />
      }
    >
      <ProviderList
        googleDisabled={fetchStatus === "fetching"}
        onEmail={() => {
          setLocalMessage(undefined);
          setPhase("email");
        }}
        onGoogle={() => void startGoogle()}
      />

      {phase !== "idle" ? (
        <EmailCodePanel
          mode="sign-up"
          stage={phase === "code" ? "code" : "identifier"}
          email={email}
          code={code}
          busy={fetchStatus === "fetching"}
          error={errorMessage}
          notice={localMessage && errorMessage !== localMessage ? localMessage : undefined}
          captchaSlot={<div id="clerk-captcha" />}
          onEmailChange={setEmail}
          onCodeChange={setCode}
          onBack={() => {
            setLocalMessage(undefined);
            setPhase(phase === "code" ? "email" : "idle");
          }}
          onSubmitIdentifier={() => void requestEmailCode()}
          onSubmitCode={() => void verifyEmailCode()}
          onResendCode={() => void resendCode()}
        />
      ) : initialNotice ? (
        <div className="rounded-card bg-white/68 px-5 py-4 text-left text-sm text-copy">
          {initialNotice}
        </div>
      ) : null}
    </AuthShell>
  );
}
