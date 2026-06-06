"use client";

// Render-less island that runs the legacy-localStorage cleanup once on
// mount. Mounted high in AppShell so it runs on every authenticated route;
// the cleanup itself uses sessionStorage to no-op after the first run.

import { useEffect } from "react";

import { runLegacyLocalStorageCleanup } from "@/features/offline/legacy-localstorage-cleanup";

export function LegacyLocalStorageCleanupRunner() {
  useEffect(() => {
    runLegacyLocalStorageCleanup();
  }, []);
  return null;
}
