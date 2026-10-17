import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";

type EmailCodePanelProps = {
  mode: "sign-in" | "sign-up";
  stage: "identifier" | "code";
  email: string;
  code: string;
  busy: boolean;
  disabled?: boolean;
  interactionLocked?: boolean;
  error?: string;
  notice?: string;
  captchaSlot?: ReactNode;
  onEmailChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onBack: () => void;
  onSubmitIdentifier: () => void;
  onSubmitCode: () => void;
  onResendCode: () => void;
};

export function EmailCodePanel({
  mode,
  stage,
  email,
  code,
  busy,
  disabled = false,
  interactionLocked = false,
  error,
  notice,
  captchaSlot,
  onEmailChange,
  onCodeChange,
  onBack,
  onSubmitIdentifier,
  onSubmitCode,
  onResendCode,
}: EmailCodePanelProps) {
  const t = useTranslations("auth.emailCode");
  const tCommon = useTranslations("common");
  const isSignUp = mode === "sign-up";

  return (
    <div className="space-y-4 rounded-card bg-surface p-5 text-left">
      <div className="space-y-1">
        <p className="text-sm uppercase tracking-[0.22em] text-muted">
          {stage === "identifier" ? t("identifierEyebrow") : t("codeEyebrow")}
        </p>
        <p className="text-base text-copy">
          {stage === "identifier"
            ? isSignUp
              ? t("signUpIdentifierBody")
              : t("signInIdentifierBody")
            : t("codeSentTo", { email })}
        </p>
      </div>

      {notice ? (
        <div className="rounded-2xl bg-paper px-4 py-3 text-sm text-copy">
          {notice}
        </div>
      ) : null}

      {stage === "identifier" ? (
        <div className="space-y-4">
          <TextInput
            disabled={interactionLocked}
            autoComplete="email"
            label={t("emailLabel")}
            placeholder={t("emailPlaceholder")}
            type="email"
            value={email}
            onChange={onEmailChange}
          />
          {captchaSlot}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="soft"
              className="flex-1"
              onClick={onBack}
              disabled={interactionLocked}
            >
              {tCommon("back")}
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={!email || busy || disabled}
              onClick={onSubmitIdentifier}
            >
              {busy ? t("sending") : t("sendCode")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <TextInput
            disabled={interactionLocked}
            autoComplete="one-time-code"
            inputClassName="tracking-[0.4em]"
            label={t("codeLabel")}
            placeholder={t("codePlaceholder")}
            value={code}
            onChange={onCodeChange}
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="soft"
              className="sm:flex-1"
              onClick={onBack}
              disabled={interactionLocked}
            >
              {t("changeEmail")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="sm:flex-1"
              disabled={busy || disabled}
              onClick={onResendCode}
            >
              {t("resendCode")}
            </Button>
            <Button
              type="button"
              className="sm:flex-1"
              disabled={!code || busy || disabled}
              onClick={onSubmitCode}
            >
              {busy
                ? isSignUp
                  ? t("creating")
                  : t("signingIn")
                : isSignUp
                  ? t("createAccount")
                  : t("verifyCode")}
            </Button>
          </div>
        </div>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
