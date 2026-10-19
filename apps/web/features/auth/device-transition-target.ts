import { reportReturnTarget } from "@/features/admin/pdf-reports/auth-return";
import { REPORT_ROUTE } from "@/features/admin/pdf-reports/query";

// Keep only the currently requested, validated operator report through an
// identity reload. No return target is stored or shared between sessions.
export function deviceTransitionTarget(currentUrl: string | undefined) {
  if (!currentUrl) return "/app";
  try {
    const url = new URL(currentUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hash
    )
      return "/app";
    if (url.pathname === REPORT_ROUTE)
      return reportReturnTarget(url.pathname + url.search);
    if (!["/sign-in", "/auth/sso-callback"].includes(url.pathname))
      return "/app";
    const seen = new Set<string>();
    for (const [key] of url.searchParams) {
      if (!["redirect_url", "notice"].includes(key) || seen.has(key))
        return "/app";
      seen.add(key);
    }
    const notice = url.searchParams.get("notice");
    if (
      notice !== null &&
      !["oauth_continue", "oauth_requirements", "signed_out"].includes(notice)
    )
      return "/app";
    return reportReturnTarget(url.searchParams.get("redirect_url"));
  } catch {
    return "/app";
  }
}
