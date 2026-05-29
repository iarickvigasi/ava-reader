"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppNavigation } from "@/components/app/core/app-navigation";
import { OfflineModalProvider } from "@/components/app/core/offline-modal-context";
import { ReaderUiProvider } from "@/components/app/core/reader-ui-context";
import { useInterfaceLang } from "@/components/app/preferences/use-interface-lang";
import type { CurrentUserPayload } from "@/lib/api-types";
import { cn } from "@/lib/cn";

type AppShellProps = {
  children: ReactNode;
  currentUser: CurrentUserPayload;
};

export function AppShell({ children, currentUser }: AppShellProps) {
  const pathname = usePathname();
  const isReaderRoute = pathname.startsWith("/app/read/");
  // Mount the interface-language hook globally so the locale cookie stays in
  // sync with the DB-saved preference on every page (not just when the
  // preferences panel is open). The hook reconciles the cookie +
  // soft-refreshes when they disagree.
  useInterfaceLang();

  // OfflineModalProvider wraps everything so the modal can fire from any
  // route (home, library, reader, …) and the offline chip in the header
  // can call `open()`. The provider also auto-opens the modal on cold boot
  // when offline and on connection drop while reading.
  if (isReaderRoute) {
    return (
      <OfflineModalProvider>
        <ReaderUiProvider>
          <div className="flex h-dvh flex-col overflow-hidden">
            <AppNavigation currentUser={currentUser} />
            <div className="min-h-0 flex-1">{children}</div>
          </div>
        </ReaderUiProvider>
      </OfflineModalProvider>
    );
  }

  return (
    <OfflineModalProvider>
      <div className="min-h-screen">
        <AppNavigation currentUser={currentUser} />
        <div className={cn(!isReaderRoute && "pb-24 md:pb-10")}>{children}</div>
      </div>
    </OfflineModalProvider>
  );
}
