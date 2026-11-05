"use client";
import { useTranslations } from "next-intl";
import { useSignUpFlow } from "@/features/auth/use-sign-up-flow";
import { AuthRouteSwitcher } from "./auth-route-switcher";
import { AuthShell } from "./auth-shell";
import { EmailCodePanel } from "./email-code-panel";
import { ProviderList } from "./provider-list";

type Props = { initialNotice?: string };

export function SignUpFlow({ initialNotice }: Props) {
  const t = useTranslations("auth.signUp");
  const flow = useSignUpFlow(initialNotice);
  if (flow.signedIn) return null;
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
        googleDisabled={flow.busy}
        onEmail={flow.openEmail}
        onGoogle={flow.google}
      />
      {flow.phase !== "idle" ? (
        <EmailCodePanel
          mode="sign-up"
          stage={flow.phase === "code" ? "code" : "identifier"}
          email={flow.email}
          code={flow.code}
          busy={flow.busy}
          error={flow.error}
          notice={
            flow.message && flow.error !== flow.message
              ? flow.message
              : undefined
          }
          captchaSlot={<div id="clerk-captcha" />}
          onEmailChange={flow.setEmail}
          onCodeChange={flow.setCode}
          onBack={flow.back}
          onSubmitIdentifier={flow.request}
          onSubmitCode={flow.verify}
          onResendCode={flow.resend}
        />
      ) : initialNotice ? (
        <div className="rounded-card bg-white/68 px-5 py-4 text-left text-sm text-copy">
          {initialNotice}
        </div>
      ) : null}
    </AuthShell>
  );
}
