"use client";

import { NetworkMonitor } from "@/features/offline/net/network-monitor";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppNavigation } from "@/components/app/core/app-navigation";
import { AppToast } from "@/components/app/core/app-toast";
import { LegacyLocalStorageCleanupRunner } from "@/components/app/core/legacy-localstorage-cleanup-runner";
import { MissingBookOfflineModal } from "@/components/app/core/missing-book-offline-modal";
import { OfflineModalProvider } from "@/components/app/core/offline-modal-context";
import { RoutePrecacheRunner } from "@/components/app/core/route-precache-runner";
import { ServiceWorkerRegistrar } from "@/components/app/core/service-worker-registrar";
import { AccountSyncRunner } from "@/features/auth/account-sync-runner";
import { AuthStatusNotice } from "@/components/auth/auth-status-notice";
import { SignedOutRedirectRunner } from "@/components/app/core/signed-out-redirect-runner";
import { ProgressSyncRunner } from "@/components/app/core/progress-sync-runner";
import { PreferencesSyncRunner } from "@/components/app/preferences/preferences-sync-runner";
import { DownloadedChapterLabelMigration } from "@/features/offline/buckets/book";
import { BackgroundPrimer } from "@/features/offline/prime";
import { ReaderUiProvider } from "@/components/app/core/reader-ui-context";
import { ReaderShell } from "./reader-shell";
import { useLockDocumentOverscroll } from "@/components/app/core/use-lock-document-overscroll";
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

export function AppShell({
  children,
  currentUser: initialUser,
}: AppShellProps) {
  const pathname = usePathname();
  const isReaderRoute = pathname.startsWith("/app/read/");
  const currentUser = useCurrentUserCached(initialUser);
  // Mount the interface-language hook globally so the locale cookie stays in
  // sync with the DB-saved preference on every page (not just when the
  // preferences panel is open). The hook reconciles the cookie +
  // soft-refreshes when they disagree.
  useInterfaceLang();
  // Reader only: its shell is a non-scrolling h-dvh box, so any vertical drag
  // is pure rubber-band — and that viewport travel re-paginates mid-swipe.
  useLockDocumentOverscroll(isReaderRoute);

  // Global sync, migration, and offline islands run on every app route.
  // Only the page chrome differs between the reader and other screens.
  return (
    <OfflineModalProvider>
      <NetworkMonitor />
      <ServiceWorkerRegistrar />
      <SignedOutRedirectRunner />
      <AuthStatusNotice />
      <AccountSyncRunner />
      <RoutePrecacheRunner />
      <BackgroundPrimer />
      <DownloadedChapterLabelMigration />
      <LegacyLocalStorageCleanupRunner />
      <PreferencesSyncRunner />
      <ProgressSyncRunner />
      <AppToast />
      <MissingBookOfflineModal />
      {isReaderRoute ? (
        <ReaderUiProvider>
          <ReaderShell navigation={<AppNavigation currentUser={currentUser} />}>
            {children}
          </ReaderShell>
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
