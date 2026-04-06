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
    <ScreenContainer className="py-12 sm:py-16">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col text-center">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full space-y-10">
            <div className="space-y-10">
              <BrandWordmark variant="compact" />
              <div className="space-y-3">
                <h1 className="font-display text-[2.2rem] leading-none text-title sm:text-[2.6rem]">
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
          </div>
        </div>

        <div className="w-full max-w-sm self-center space-y-5 pt-10">
          {footer}
          <LegalCopy />
        </div>
      </div>
    </ScreenContainer>
  );
}
