import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  authSdk,
  renderAuthFlow,
  settleAuth,
} from "./auth-readiness-dispatch-fixture";
import { authHooks, resetAuthHooks } from "./auth-readiness-test-hooks";
import { SignInFlow } from "./sign-in-flow";

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  resetAuthHooks();
  authSdk.loaded = true;
  authSdk.client = { signIn: { authenticateWithRedirect: authSdk.redirect } };
});
afterEach(() => {
  authHooks.effects.forEach((effect) => effect.cleanup?.());
  vi.useRealTimers();
});

it("dispatches the enabled Google action once before passive readiness effects and recovers from rejection", async () => {
  authSdk.loaded = false;
  expect(renderAuthFlow(SignInFlow).providers.googleDisabled).toBe(true);
  authSdk.loaded = true;
  let view = renderAuthFlow(SignInFlow, false);
  expect(view.providers.googleDisabled).toBe(false);
  expect(view.notice.readiness).toBe("ready");
  let reject!: (error: Error) => void;
  authSdk.redirect.mockReturnValue(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  view.providers.onGoogle();
  view.providers.onGoogle();
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
  view = renderAuthFlow(SignInFlow, false);
  expect(view.providers.googleDisabled).toBe(true);
  expect(view.notice.operation).toBe("pending");
  reject(new Error("SDK rejected"));
  await settleAuth();
  view = renderAuthFlow(SignInFlow);
  expect(view.providers.googleDisabled).toBe(false);
  expect(view.notice.error).toBe("errors.googleStartFailed");
});

it("refuses a stale enabled Google handler after readiness is lost at the next visible commit", () => {
  const stale = renderAuthFlow(SignInFlow);
  authSdk.loaded = false;
  const current = renderAuthFlow(SignInFlow, false);
  expect(current.providers.googleDisabled).toBe(true);
  stale.providers.onGoogle();
  current.providers.onGoogle();
  expect(authSdk.redirect).not.toHaveBeenCalled();
});

it("does not send an email code when readiness is lost before an in-flight create resolves", async () => {
  renderAuthFlow(SignInFlow).providers.onEmail();
  renderAuthFlow(SignInFlow).panel!.onEmailChange("reader@example.test");
  let finish!: (value: { error: null }) => void;
  authSdk.create.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const stale = renderAuthFlow(SignInFlow);
  stale.panel!.onSubmitIdentifier();
  expect(authSdk.create).toHaveBeenCalledTimes(1);
  authSdk.loaded = false;
  renderAuthFlow(SignInFlow, false);
  stale.panel!.onSubmitIdentifier();
  finish({ error: null });
  await settleAuth();
  expect(authSdk.create).toHaveBeenCalledTimes(1);
  expect(authSdk.send).not.toHaveBeenCalled();
});
