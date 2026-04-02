import type { ReactNode } from "react";
import { ProviderButton } from "@/components/auth/provider-button";

type ProviderListProps = {
  children?: ReactNode;
  googleDisabled?: boolean;
  onEmail: () => void;
  onGoogle: () => void;
};

function EmailIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6 text-copy-strong"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5.5 8L12 13L18.5 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GoogleGlyph() {
  return (
    <span
      aria-hidden="true"
      className="font-display text-[1.9rem] leading-none text-brand-foreground"
    >
      G
    </span>
  );
}

export function ProviderList({
  children,
  googleDisabled,
  onEmail,
  onGoogle,
}: ProviderListProps) {
  return (
    <div className="space-y-4">
      <ProviderButton
        icon={<EmailIcon />}
        label="Continue with Email"
        variant="soft"
        onClick={onEmail}
      />
      <ProviderButton
        icon={<GoogleGlyph />}
        label="Continue with Google"
        onClick={onGoogle}
        disabled={googleDisabled}
      />
      {children}
    </div>
  );
}
