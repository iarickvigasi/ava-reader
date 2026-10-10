import type { SignInResource } from "@clerk/nextjs/types";

type GoogleAttempt = Pick<SignInResource, "authenticateWithRedirect">;

// Documented public legacy API: force a fresh attempt without reusing a captured Future.
// Reset also replaces the resource: https://github.com/clerk/javascript/issues/9006
export async function startFreshGoogleSignIn(
  getAttempt: () => GoogleAttempt | undefined,
) {
  try {
    const attempt = getAttempt();
    if (!attempt) return false;
    await attempt.authenticateWithRedirect({
      strategy: "oauth_google",
      redirectUrl: "/auth/sso-callback",
      redirectUrlComplete: "/app",
      continueSignIn: false,
    });
    return true;
  } catch {
    return false;
  }
}
