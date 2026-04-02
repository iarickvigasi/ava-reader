"use client";

import { useAuth, useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthRouteSwitcher } from "@/components/auth/auth-route-switcher";
import { AuthShell } from "@/components/auth/auth-shell";
import { EmailCodePanel } from "@/components/auth/email-code-panel";
import { getClerkErrorMessage } from "@/components/auth/clerk-error";
import { ProviderList } from "@/components/auth/provider-list";

type SignInFlowProps = {
  initialNotice?: string;
};

type Phase = "idle" | "email" | "code";

export function SignInFlow({ initialNotice }: SignInFlowProps) {
  const { signIn, errors, fetchStatus } = useSignIn();
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
    await signIn.finalize({
      navigate: async ({ decorateUrl, session }) => {
        if (session?.currentTask) {
          setLocalMessage(
            "Additional account work is required before the session can continue.",
          );
          return;
        }

        const targetUrl = decorateUrl("/app");
        router.replace(targetUrl);
      },
    });
  };

  const startGoogle = async () => {
    setLocalMessage(undefined);
    const { error } = await signIn.sso({
      strategy: "oauth_google",
      redirectUrl: "/app",
      redirectCallbackUrl: "/auth/sso-callback",
    });

    if (error) {
      setLocalMessage("Google sign-in could not be started.");
    }
  };

  const requestEmailCode = async () => {
    setLocalMessage(undefined);
    const { error } = await signIn.create({ identifier: email });

    if (error) {
      return;
    }

    const result = await signIn.emailCode.sendCode();

    if (result.error) {
      return;
    }

    setPhase("code");
  };

  const verifyEmailCode = async () => {
    setLocalMessage(undefined);
    const { error } = await signIn.emailCode.verifyCode({ code });

    if (error) {
      return;
    }

    if (signIn.status === "complete") {
      await finalize();
      return;
    }

    if (signIn.status === "needs_second_factor") {
      setLocalMessage(
        "This account requires a second authentication factor, which is not wired yet.",
      );
      return;
    }

    if (signIn.status === "needs_client_trust") {
      setLocalMessage(
        "Clerk requested client trust verification. Continue on the same trusted device or update your Clerk settings.",
      );
      return;
    }

    setLocalMessage("The sign-in attempt is not complete yet.");
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
      title="Sign In"
      footer={
        <AuthRouteSwitcher
          prompt="Need an account?"
          actionLabel="Create one"
          href="/sign-up"
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
          mode="sign-in"
          stage={phase === "code" ? "code" : "identifier"}
          email={email}
          code={code}
          busy={fetchStatus === "fetching"}
          error={errorMessage}
          notice={localMessage && errorMessage !== localMessage ? localMessage : undefined}
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
        <div className="rounded-[var(--radius-card)] border border-line bg-white/68 px-5 py-4 text-left text-sm text-copy shadow-[var(--shadow-card)]">
          {initialNotice}
        </div>
      ) : null}
    </AuthShell>
  );
}
