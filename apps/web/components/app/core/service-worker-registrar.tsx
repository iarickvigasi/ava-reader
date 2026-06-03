"use client";

// Render-less island that registers the offline service worker once on mount.
// Mounted high in the app tree (AppShell) so it runs on every authenticated
// route. No-ops in development and when the SW API is unavailable.
//
// We resolve the failure-toast string here (rather than inside the registrar)
// because the registrar is a plain TS module — it can't use next-intl hooks.
// The string is passed down so the registrar's catch block can emit a
// localized toast.

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { registerServiceWorker } from "@/features/offline/sw";

export function ServiceWorkerRegistrar() {
  const t = useTranslations("offline.toast");

  useEffect(() => {
    registerServiceWorker({ failureToastMessage: t("swFailed") });
    // `t` is stable per locale; we want one registration attempt per mount,
    // not one per `t` identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
