type Attempt = {
  status: string | null;
  firstFactorVerification: { status: string | null };
  reset: () => Promise<{ error: unknown }>;
  sso: (options: {
    strategy: "oauth_google";
    redirectUrl: string;
    redirectCallbackUrl: string;
  }) => Promise<{ error: unknown }>;
};

export async function startGoogleSignIn(signIn: Attempt) {
  if (
    signIn.firstFactorVerification.status === "expired" ||
    signIn.status === "needs_identifier"
  ) {
    const result = await signIn.reset();
    if (result.error) throw result.error;
  }
  const result = await signIn.sso({
    strategy: "oauth_google",
    redirectUrl: "/app",
    redirectCallbackUrl: "/auth/sso-callback",
  });
  if (result.error) throw result.error;
}
