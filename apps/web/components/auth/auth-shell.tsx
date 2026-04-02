import type { ReactNode } from "react";
import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { LegalCopy } from "@/components/brand/legal-copy";
import { ScreenContainer } from "@/components/ui/screen-container";

type AuthShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
};

export function AuthShell({
  children,
  title,
  subtitle,
  footer,
}: AuthShellProps) {
  return (
    <ScreenContainer className="justify-center py-12 sm:py-16">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-10 text-center">
        <div className="space-y-5">
          <BrandWordmark variant="compact" />
          <div className="space-y-3">
            <h1 className="font-display text-5xl leading-none text-title sm:text-[3.5rem]">
              {title}
            </h1>
            {subtitle ? (
              <p className="mx-auto max-w-sm text-lg text-copy sm:text-xl">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="w-full space-y-6">{children}</div>

        <div className="w-full max-w-sm space-y-5">
          {footer}
          <LegalCopy />
        </div>
      </div>
    </ScreenContainer>
  );
}
