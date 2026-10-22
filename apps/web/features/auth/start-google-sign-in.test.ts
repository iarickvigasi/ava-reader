import { expect, it, vi } from "vitest";
import { startGoogleSignIn } from "./start-google-sign-in";

function attempt(status = "expired") {
  return {
    status: "needs_identifier",
    firstFactorVerification: { status },
    reset: vi.fn(async () => ({ error: null as unknown })),
    sso: vi.fn(async () => ({ error: null as unknown })),
  };
}

it("resets the observed expired attempt before starting Google", async () => {
  const signIn = attempt();
  await startGoogleSignIn(signIn);
  expect(signIn.reset).toHaveBeenCalledOnce();
  expect(signIn.reset.mock.invocationCallOrder[0]).toBeLessThan(
    signIn.sso.mock.invocationCallOrder[0],
  );
  expect(signIn.sso).toHaveBeenCalledWith({
    strategy: "oauth_google",
    redirectUrl: "/app",
    redirectCallbackUrl: "/auth/sso-callback",
  });
});
it("starts a fresh attempt without resetting it", async () => {
  const signIn = { ...attempt("unverified"), status: null };
  await startGoogleSignIn(signIn);
  expect(signIn.reset).not.toHaveBeenCalled();
  expect(signIn.sso).toHaveBeenCalledOnce();
});
it("stops if reset fails and propagates SSO errors", async () => {
  const signIn = attempt();
  signIn.reset.mockResolvedValueOnce({ error: new Error("reset") });
  await expect(startGoogleSignIn(signIn)).rejects.toThrow("reset");
  expect(signIn.sso).not.toHaveBeenCalled();
  signIn.sso.mockResolvedValueOnce({ error: new Error("sso") });
  await expect(startGoogleSignIn(signIn)).rejects.toThrow("sso");
});
