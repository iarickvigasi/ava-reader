import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  authSdk,
  renderAuthFlow,
  settleAuth,
} from "./auth-readiness-dispatch-fixture";
import { authHooks, resetAuthHooks } from "./auth-readiness-test-hooks";
import { SignInFlow } from "./sign-in-flow";
import { AUTH_TIMEOUT_MS } from "@/features/auth/with-deadline";

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  resetAuthHooks();
  authSdk.loaded = true;
  authSdk.client = { signIn: { authenticateWithRedirect: authSdk.redirect } };
  authSdk.redirect.mockResolvedValue(undefined);
  authSdk.sso.mockResolvedValue({ error: null }); // Captured Future can silently succeed.
});
afterEach(() => {
  authHooks.effects.forEach((effect) => effect.cleanup?.());
  vi.useRealTimers();
});

it("starts a fresh Google attempt on the live public resource, not the captured Future", async () => {
  const oldRedirect = vi.fn();
  authSdk.client = {
    signIn: {
      id: "old-unfinished-attempt",
      authenticateWithRedirect: oldRedirect,
    },
  };
  const view = renderAuthFlow(SignInFlow);
  // Replace the unfinished attempt after render; fresh creation must still be explicit.
  authSdk.client = {
    signIn: {
      id: "live-unfinished-attempt",
      authenticateWithRedirect: authSdk.redirect,
    },
  };
  view.providers.onGoogle();
  await settleAuth();
  expect(authSdk.redirect.mock.calls).toEqual([
    [
      {
        strategy: "oauth_google",
        redirectUrl: "/auth/sso-callback",
        redirectUrlComplete: "/app",
        continueSignIn: false,
      },
    ],
  ]);
  expect(oldRedirect).not.toHaveBeenCalled();
  expect(authSdk.sso).not.toHaveBeenCalled();
});

it("reports unavailable public client instead of returning silent success", async () => {
  authSdk.client = undefined;
  renderAuthFlow(SignInFlow).providers.onGoogle();
  await settleAuth();
  expect(renderAuthFlow(SignInFlow).notice.error).toBe(
    "errors.googleStartFailed",
  );
  expect(authSdk.redirect).not.toHaveBeenCalled();
  expect(authSdk.sso).not.toHaveBeenCalled();
});

it("reports a redirect rejection and allows a settled retry", async () => {
  authSdk.redirect.mockRejectedValueOnce(new Error("provider failed"));
  renderAuthFlow(SignInFlow).providers.onGoogle();
  await settleAuth();
  const view = renderAuthFlow(SignInFlow);
  expect(view.notice.error).toBe("errors.googleStartFailed");
  expect(view.providers.googleDisabled).toBe(false);
  view.providers.onGoogle();
  await settleAuth();
  expect(authSdk.redirect).toHaveBeenCalledTimes(2);
});

it.each(["readiness loss", "timeout", "unmount"])(
  "ignores a late rejected Google attempt after %s",
  async (loss) => {
    let reject!: (error: Error) => void;
    authSdk.redirect.mockReturnValue(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    const view = renderAuthFlow(SignInFlow);
    view.providers.onGoogle();
    view.providers.onGoogle();
    expect(authSdk.redirect).toHaveBeenCalledTimes(1);
    if (loss === "readiness loss") {
      authSdk.loaded = false;
      renderAuthFlow(SignInFlow, false);
    } else if (loss === "timeout") vi.advanceTimersByTime(AUTH_TIMEOUT_MS);
    else authHooks.effects.forEach((effect) => effect.cleanup?.());
    reject(new Error("late provider failure"));
    await settleAuth();
    expect(renderAuthFlow(SignInFlow).notice.error).toBeUndefined();
    view.providers.onGoogle();
    expect(authSdk.redirect).toHaveBeenCalledTimes(1);
  },
);
