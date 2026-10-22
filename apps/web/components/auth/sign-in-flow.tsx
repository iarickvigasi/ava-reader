"use client";

import { useTranslations } from "next-intl";
import { AuthRouteSwitcher } from "./auth-route-switcher";
import { AuthShell } from "./auth-shell";
import { EmailCodePanel } from "./email-code-panel";
import { ProviderList } from "./provider-list";
import { useSignInFlow } from "@/features/auth/use-sign-in-flow";

type SignInFlowProps = { initialNotice?: string };

export function SignInFlow({ initialNotice }: SignInFlowProps) {
  const t = useTranslations("auth.signIn");
  const tErrors = useTranslations("auth.shared.errors");
  const flow = useSignInFlow(initialNotice);
  if (flow.signedIn) return null;
  const message = flow.online ? flow.message : tErrors("offline");
  return (
    <AuthShell
      title={t("title")}
      footer={
        <AuthRouteSwitcher
          prompt={t("switchPrompt")}
          actionLabel={t("switchAction")}
          href="/sign-up"
        />
      }
    >
      <ProviderList
        googleDisabled={flow.busy || !flow.online}
        onEmail={flow.openEmail}
        onGoogle={flow.google}
      />
      {message ? (
        <p
          role="alert"
          className="rounded-card bg-surface px-5 py-4 text-sm text-copy"
        >
          {message}
        </p>
      ) : null}
      {flow.phase !== "idle" ? (
        <EmailCodePanel
          mode="sign-in"
          stage={flow.phase === "code" ? "code" : "identifier"}
          email={flow.email}
          code={flow.code}
          busy={flow.busy || !flow.online}
          onEmailChange={flow.setEmail}
          onCodeChange={flow.setCode}
          onBack={flow.back}
          onSubmitIdentifier={flow.request}
          onSubmitCode={flow.verify}
          onResendCode={flow.resend}
        />
      ) : null}
    </AuthShell>
  );
}
