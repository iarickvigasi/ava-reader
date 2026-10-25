import type { ReactNode } from "react";
import { ScreenContainer } from "@/components/ui/screen-container";

export function LibraryScreenShell({ children }: { children: ReactNode }) {
  return (
    <ScreenContainer className="gap-10 py-10 sm:gap-16 sm:py-16">
      {children}
    </ScreenContainer>
  );
}
