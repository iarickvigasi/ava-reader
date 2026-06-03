"use client";

// Render-less island that registers the offline service worker once on mount.
// Mounted high in the app tree (AppShell) so it runs on every authenticated
// route. No-ops in development and when the SW API is unavailable.

import { useEffect } from "react";

import { registerServiceWorker } from "@/features/offline/sw";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return null;
}
