import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";
import {
  dispatchFetch,
  fakeRequest,
  loadServiceWorker,
  ORIGIN,
} from "./sw-test-harness";

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => [initial, vi.fn()],
  useEffect: vi.fn(),
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true }),
  AuthenticateWithRedirectCallback: () => null,
}));
import SignInPage from "@/app/sign-in/page";
import CallbackPage from "@/app/auth/sso-callback/page";
import { startFreshGoogleSignIn } from "@/features/auth/start-fresh-google-sign-in";
import { SsoCallbackHandler } from "@/components/auth/sso-callback-handler";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

const target =
  "/app/admin/pdf-reports?kind=conversionId&reference=pdf-authored&view=export&eventCursor=events-56&costCursor=cost-4";
function callbackTarget(node: ReactNode): string | undefined {
  if (Array.isArray(node)) return node.map(callbackTarget).find(Boolean);
  if (
    !isValidElement<{ signInForceRedirectUrl: string; children?: ReactNode }>(
      node,
    )
  )
    return;
  return node.type === AuthenticateWithRedirectCallback
    ? node.props.signInForceRedirectUrl
    : callbackTarget(node.props.children);
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "public-authored-config");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it.each(["/sign-in", "/auth/sso-callback"])(
  "cannot substitute cached generic %s server props under a report-return URL",
  async (pathname) => {
    const page = pathname === "/sign-in" ? SignInPage : CallbackPage;
    const generic = await page({ searchParams: Promise.resolve({}) });
    const current = await page({
      searchParams: Promise.resolve({ redirect_url: target }),
    });
    expect(generic.props.returnTo).toBe("/app");
    expect(current.props.returnTo).toBe(target);
    if (pathname === "/sign-in") {
      const fresh = vi.fn().mockResolvedValue(undefined);
      await startFreshGoogleSignIn(
        () => ({ authenticateWithRedirect: fresh }),
        current.props.returnTo,
      );
      expect(fresh.mock.calls[0][0].redirectUrlComplete).toBe(target);
    } else {
      expect(callbackTarget(SsoCallbackHandler(current.props))).toBe(target);
    }
    const sw = loadServiceWorker(),
      cache = await sw.cacheStorage.open("ava-reader-sw-test");
    // Authored props carrier from the actual server component, not a claim of
    // rendering Next's complete Flight/HTML protocol or a real browser cache.
    await cache.put(
      `${ORIGIN}${pathname}?__sw=doc`,
      new Response(JSON.stringify({ returnTo: generic.props.returnTo })),
    );
    sw.fetchMock.mockReturnValue(new Promise<Response>(() => {}));
    const request = fakeRequest(
      `${pathname}?redirect_url=${encodeURIComponent(target)}`,
      { mode: "navigate" },
    );
    const pending = dispatchFetch(sw.listeners.fetch!, request);
    await vi.advanceTimersByTimeAsync(3_000);
    const response = await pending;
    if (response) {
      const cached = (await response.json()) as { returnTo: string };
      const dispatch = vi.fn().mockResolvedValue(undefined);
      if (pathname === "/sign-in") {
        await startFreshGoogleSignIn(
          () => ({ authenticateWithRedirect: dispatch }),
          cached.returnTo,
        );
        expect(dispatch.mock.calls[0][0].redirectUrlComplete).toBe("/app");
      } else {
        expect(callbackTarget(SsoCallbackHandler(cached))).toBe("/app");
      }
      expect(new URL(request.url).searchParams.get("redirect_url")).toBe(
        target,
      );
    }
    expect(response).toBeUndefined();
    expect(sw.fetchMock).not.toHaveBeenCalled();
  },
);

it.each([
  "/sign-in",
  "/sign-in/factor-one",
  "/sign-up",
  "/sign-up/continue",
  "/auth/sso-callback",
  "/auth/sso-callback/continue",
])(
  "never serves an old auth cache on an offline %s navigation",
  async (pathname) => {
    const sw = loadServiceWorker(),
      cache = await sw.cacheStorage.open("ava-reader-sw-test");
    await cache.put(`${ORIGIN}${pathname}?__sw=doc`, new Response("OLD_AUTH"));
    sw.fetchMock.mockRejectedValue(new Error("authored offline"));
    expect(
      await dispatchFetch(
        sw.listeners.fetch!,
        fakeRequest(pathname, { mode: "navigate" }),
      ),
    ).toBeUndefined();
    expect(sw.fetchMock).not.toHaveBeenCalled();
  },
);
it("excludes auth documents from route priming while keeping Library and similar public paths", async () => {
  const sw = loadServiceWorker(),
    reply = vi.fn();
  sw.fetchMock.mockResolvedValue(new Response("PUBLIC"));
  let work: Promise<unknown> | undefined;
  sw.listeners.message!({
    data: {
      type: "PRECACHE_ROUTES",
      routes: [
        `${ORIGIN}/sign-in`,
        `${ORIGIN}/sign-up`,
        `${ORIGIN}/auth/sso-callback`,
        `${ORIGIN}/app/library`,
        `${ORIGIN}/sign-in-guide`,
      ],
    },
    ports: [{ postMessage: reply }],
    waitUntil: (value: Promise<unknown>) => {
      work = value;
    },
  });
  await work;
  expect(reply).toHaveBeenCalledWith({
    cached: [`${ORIGIN}/app/library`, `${ORIGIN}/sign-in-guide`],
  });
  expect(sw.fetchMock.mock.calls.map(([request]) => request.url)).toEqual([
    `${ORIGIN}/app/library`,
    `${ORIGIN}/sign-in-guide`,
  ]);
});
