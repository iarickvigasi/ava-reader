import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";

type EmailCodePanelProps = {
  mode: "sign-in" | "sign-up";
  stage: "identifier" | "code";
  email: string;
  code: string;
  busy: boolean;
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
  const isSignUp = mode === "sign-up";

  return (
    <div className="space-y-4 rounded-[var(--radius-card)] bg-white/68 p-5 text-left">
      <div className="space-y-1">
        <p className="text-sm uppercase tracking-[0.22em] text-muted">
          {stage === "identifier" ? "Email access" : "Verify your code"}
        </p>
        <p className="text-base text-copy">
          {stage === "identifier"
            ? isSignUp
              ? "Enter your email to receive a one-time code and create your account."
              : "Enter the email attached to your account and we will send you a one-time code."
            : `We sent a one-time code to ${email}.`}
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
            autoComplete="email"
            label="Email"
            placeholder="name@example.com"
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
            >
              Back
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={!email || busy}
              onClick={onSubmitIdentifier}
            >
              {busy ? "Sending..." : "Send code"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <TextInput
            autoComplete="one-time-code"
            inputClassName="tracking-[0.4em]"
            label="Code"
            placeholder="123456"
            value={code}
            onChange={onCodeChange}
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="soft"
              className="sm:flex-1"
              onClick={onBack}
            >
              Change email
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="sm:flex-1"
              disabled={busy}
              onClick={onResendCode}
            >
              Resend code
            </Button>
            <Button
              type="button"
              className="sm:flex-1"
              disabled={!code || busy}
              onClick={onSubmitCode}
            >
              {busy
                ? isSignUp
                  ? "Creating..."
                  : "Signing in..."
                : isSignUp
                  ? "Create account"
                  : "Verify code"}
            </Button>
          </div>
        </div>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
