"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppNavigation } from "@/components/app/core/app-navigation";
import { AppToast } from "@/components/app/core/app-toast";
import { LegacyLocalStorageCleanupRunner } from "@/components/app/core/legacy-localstorage-cleanup-runner";
import { MissingBookOfflineModal } from "@/components/app/core/missing-book-offline-modal";
import { OfflineModalProvider } from "@/components/app/core/offline-modal-context";
import { RoutePrecacheRunner } from "@/components/app/core/route-precache-runner";
import { ServiceWorkerRegistrar } from "@/components/app/core/service-worker-registrar";
import { ProgressSyncRunner } from "@/components/app/core/progress-sync-runner";
import { PreferencesSyncRunner } from "@/components/app/preferences/preferences-sync-runner";
import { BackgroundPrimer } from "@/features/offline/prime";
import { ReaderUiProvider } from "@/components/app/core/reader-ui-context";
import { useInterfaceLang } from "@/components/app/preferences/use-interface-lang";
import { useCurrentUserCached } from "@/features/offline/buckets/me";
import type { CurrentUserPayload } from "@/lib/api-types";

type AppShellProps = {
  children: ReactNode;
  // Null when the layout's /api/me fetch failed (offline). We recover the
  // last-known user from Dexie via useCurrentUserCached so the nav still
  // renders the admin entry + display name on an offline reload.
  currentUser: CurrentUserPayload | null;
};

export function AppShell({ children, currentUser: initialUser }: AppShellProps) {
  const pathname = usePathname();
  const isReaderRoute = pathname.startsWith("/app/read/");
  const currentUser = useCurrentUserCached(initialUser);
  // Mount the interface-language hook globally so the locale cookie stays in
  // sync with the DB-saved preference on every page (not just when the
  // preferences panel is open). The hook reconciles the cookie +
  // soft-refreshes when they disagree.
  useInterfaceLang();

  // The global islands below must live on EVERY app route, not just the
  // reader: AppToast surfaces save/quota toasts from library + home, the sync
  // / cleanup runners are app-wide, and the offline modals are dispatched from
  // non-reader surfaces too (ReadBookLink on book-info / home fires the
  // missing-book modal). Only the page chrome differs by route, so just the
  // layout branches. OfflineModalProvider wraps everything so the offline
  // modal can fire from any route and the header chip's `open()` works.
  return (
    <OfflineModalProvider>
      <ServiceWorkerRegistrar />
      <RoutePrecacheRunner />
      <BackgroundPrimer />
      <LegacyLocalStorageCleanupRunner />
      <PreferencesSyncRunner />
      <ProgressSyncRunner />
      <AppToast />
      <MissingBookOfflineModal />
      {isReaderRoute ? (
        <ReaderUiProvider>
          <div className="flex h-dvh flex-col overflow-hidden">
            <AppNavigation currentUser={currentUser} />
            <div className="min-h-0 flex-1">{children}</div>
          </div>
        </ReaderUiProvider>
      ) : (
        <div className="min-h-screen">
          <AppNavigation currentUser={currentUser} />
          <div className="pb-24 md:pb-10">{children}</div>
        </div>
      )}
    </OfflineModalProvider>
  );
}
