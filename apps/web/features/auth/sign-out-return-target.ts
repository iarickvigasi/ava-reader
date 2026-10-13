import { reportReturnTarget } from "@/features/admin/pdf-reports/auth-return";
import {
  isReportHandshakeCleanup,
  reportHandshakeKeys,
} from "@/features/admin/pdf-reports/handshake-cleanup";
import { REPORT_ROUTE } from "@/features/admin/pdf-reports/query";
import { deviceTransitionTarget } from "./device-transition-target";

// Preserve only the current validated operator destination; never store a URL
// or forward Clerk transport values through the app's sign-in return query.
export function signOutReturnTarget(currentUrl: string): string {
  let target = deviceTransitionTarget(currentUrl);
  if (target === "/app") {
    try {
      const current = new URL(currentUrl);
      if (
        ["http:", "https:"].includes(current.protocol) &&
        current.pathname === REPORT_ROUTE
      ) {
        const clean = new URL(current);
        for (const key of reportHandshakeKeys) clean.searchParams.delete(key);
        if (isReportHandshakeCleanup(currentUrl, clean.href))
          target = reportReturnTarget(clean.pathname + clean.search);
      }
    } catch {
      /* Invalid destinations keep the ordinary sign-in path. */
    }
  }
  return target === "/app"
    ? "/sign-in"
    : `/sign-in?${new URLSearchParams({ redirect_url: target })}`;
}
