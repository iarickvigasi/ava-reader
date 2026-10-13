import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ComponentProps, type ReactNode } from "react";
import { authHooks, resetAuthHooks } from "./auth-readiness-test-hooks";
const sdk = vi.hoisted(() => ({
  signedIn: false,
  status: "complete",
  replace: vi.fn(),
  redirect: vi.fn(),
  finalize: vi.fn(),
  verify: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  ...(await import("./auth-readiness-test-hooks")).authMockHooks,
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: sdk.signedIn,
    userId: sdk.signedIn ? "operator" : null,
    sessionId: sdk.signedIn ? "session" : null,
  }),
  useClerk: () => ({
    client: { signIn: { authenticateWithRedirect: sdk.redirect } },
  }),
  useSignIn: () => ({
    signIn: {
      status: sdk.status,
      finalize: sdk.finalize,
      emailCode: { verifyCode: sdk.verify },
    },
    errors: { fields: {}, global: [] },
    fetchStatus: "idle",
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: sdk.replace }),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock("@/features/auth/local-sign-out", () => ({
  isLocallySignedOut: () => false,
}));
import { SignInFlow } from "./sign-in-flow";
import { EmailCodePanel } from "./email-code-panel";
import { ProviderList } from "./provider-list";
import SignInPage from "@/app/sign-in/page";
const target =
  "/app/admin/pdf-reports?kind=conversionId&reference=pdf-1&view=export&eventCursor=after-56&costCursor=cost-1";
function find<T>(node: ReactNode, type: unknown): T | undefined {
  if (Array.isArray(node))
    return node.map((child) => find<T>(child, type)).find(Boolean);
  if (!isValidElement<T & { children?: ReactNode }>(node)) return;
  return node.type === type ? node.props : find<T>(node.props.children, type);
}
function render(returnTo = target) {
  authHooks.stateCursor = authHooks.effectCursor = 0;
  const tree = SignInFlow({ returnTo });
  authHooks.layout.splice(0).forEach((commit) => commit());
  authHooks.passive.splice(0).forEach((commit) => commit());
  return tree;
}
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
beforeEach(() => {
  resetAuthHooks();
  vi.useFakeTimers();
  vi.clearAllMocks();
  sdk.signedIn = false;
  sdk.status = "complete";
  sdk.verify.mockResolvedValue({ error: null });
  sdk.finalize.mockImplementation(async ({ navigate }) =>
    navigate({ decorateUrl: (path: string) => path, session: {} }),
  );
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "public-test-config");
});
afterEach(() => {
  authHooks.effects.forEach((effect) => effect.cleanup?.());
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
it("passes the validated report target from the sign-in route into the flow", async () => {
  const tree = await SignInPage({
    searchParams: Promise.resolve({ redirect_url: target }),
  });
  expect(tree.props.returnTo).toBe(target);
});
it("returns an already signed-in operator to the exact report instead of Home", () => {
  sdk.signedIn = true;
  render();
  expect(sdk.replace).toHaveBeenCalledWith(target);
});
it("preserves the report target on ordinary email completion", async () => {
  // The existing hook host supplies the chosen email-code phase only; real handlers/finalization run.
  authHooks.states[0] = "code";
  const panel = find<ComponentProps<typeof EmailCodePanel>>(
    render(),
    EmailCodePanel,
  )!;
  panel.onSubmitCode();
  await flush();
  expect(sdk.finalize).toHaveBeenCalledTimes(1);
  expect(sdk.replace).toHaveBeenCalledWith(target);
});
it("preserves the target through the ordinary fresh Google attempt", async () => {
  const providers = find<ComponentProps<typeof ProviderList>>(
    render(),
    ProviderList,
  )!;
  providers.onGoogle();
  await flush();
  expect(sdk.redirect).toHaveBeenCalledWith(
    expect.objectContaining({
      redirectUrl: "/auth/sso-callback",
      redirectUrlComplete: target,
      continueSignIn: false,
    }),
  );
});
it.each([
  "https://outside.invalid/app/admin/pdf-reports",
  "//outside.invalid",
  "javascript:alert(1)",
  "/app/admin/pdf-reports?kind=conversionId&reference=pdf-1&unknown=value",
  "/app/admin/pdf-reports?kind=conversionId&reference=pdf-1&reference=pdf-2",
  "/app/admin/pdf-reports?kind=conversionId&reference=sk-private",
  "/app/admin/pdf-reports#fragment",
])(
  "refuses untrusted or malformed auth recovery target %s",
  async (invalid) => {
    const tree = await SignInPage({
      searchParams: Promise.resolve({ redirect_url: invalid }),
    });
    expect(tree.props.returnTo).toBe("/app");
    sdk.signedIn = true;
    render(invalid);
    expect(sdk.replace).toHaveBeenCalledWith("/app");
  },
);
