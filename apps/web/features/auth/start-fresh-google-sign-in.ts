import type { SignInResource } from "@clerk/nextjs/types";

import { reportReturnTarget } from "@/features/admin/pdf-reports/auth-return";

type GoogleAttempt = Pick<SignInResource, "authenticateWithRedirect">;

// Documented public legacy API: force a fresh attempt without reusing a captured Future.
// Reset also replaces the resource: https://github.com/clerk/javascript/issues/9006
export async function startFreshGoogleSignIn(
  getAttempt: () => GoogleAttempt | undefined,
  returnTo?: string,
) {
  try {
    const attempt = getAttempt();
    if (!attempt) return false;
    const target = reportReturnTarget(returnTo);
    const callback =
      target === "/app"
        ? "/auth/sso-callback"
        : `/auth/sso-callback?${new URLSearchParams({ redirect_url: target })}`;
    await attempt.authenticateWithRedirect({
      strategy: "oauth_google",
      redirectUrl: callback,
      redirectUrlComplete: target,
      continueSignIn: false,
    });
    return true;
  } catch {
    return false;
  }
}
