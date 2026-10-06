import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
const sdk = vi.hoisted(() => ({
  loaded: false,
  global: [] as { message: string }[],
  sso: vi.fn(),
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: sdk.loaded,
    isSignedIn: false,
    userId: null,
    sessionId: null,
  }),
  useSignIn: () => ({
    signIn: { sso: sdk.sso },
    fetchStatus: "idle",
    errors: { fields: {}, global: sdk.global },
  }),
  useSignUp: () => ({
    signUp: { sso: sdk.sso },
    fetchStatus: "idle",
    errors: { fields: {}, global: sdk.global },
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/features/auth/local-sign-out", () => ({
  isLocallySignedOut: () => false,
}));
import { SignInFlow } from "./sign-in-flow";
import { SignUpFlow } from "./sign-up-flow";
beforeEach(() => {
  sdk.loaded = false;
  sdk.global = [];
  sdk.sso.mockClear();
});

it("keeps Google unavailable until auth loads without blocking the local email choice", () => {
  for (const Component of [SignInFlow, SignUpFlow]) {
    const html = renderToStaticMarkup(withIntl(<Component />));
    expect(html).toContain("Preparing sign-in");
    const google = [
      ...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g),
    ].find((match) => match[2].includes("Continue with Google"));
    expect(google?.[1]).toMatch(/\sdisabled=""/);
  }
  expect(sdk.sso).not.toHaveBeenCalled();
});

it("renders a provider error in the idle sign-in and sign-up view", () => {
  sdk.loaded = true;
  sdk.global = [{ message: "Provider test failure" }];
  for (const Component of [SignInFlow, SignUpFlow]) {
    const html = renderToStaticMarkup(withIntl(<Component />));
    expect(html).toContain("Provider test failure");
    expect(html).toContain('role="alert"');
  }
});
