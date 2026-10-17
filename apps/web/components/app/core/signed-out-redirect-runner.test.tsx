import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  authHooks,
  resetAuthHooks,
} from "@/components/auth/auth-readiness-test-hooks";

const state = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: false as boolean | undefined,
  online: true,
  activeUserId: null as string | null,
  pathname: "/app/admin/pdf-reports" as string | null,
  search: new URLSearchParams() as URLSearchParams | null,
  router: { replace: vi.fn() },
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  ...(await import("@/components/auth/auth-readiness-test-hooks"))
    .authMockHooks,
}));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => state }));
vi.mock("next/navigation", () => ({
  useRouter: () => state.router,
  usePathname: () => state.pathname,
  useSearchParams: () => state.search,
}));
vi.mock("@/features/offline/net/use-network-state", () => ({
  useNetworkState: () => state.online,
}));
vi.mock("@/features/offline/db", () => ({
  getActiveUserId: () => state.activeUserId,
}));
import { SignedOutRedirectRunner } from "./signed-out-redirect-runner";

const query =
  "kind=conversionId&reference=pdf-1&view=export&eventCursor=after-56&costCursor=cost-1";
const target = `/app/admin/pdf-reports?${query}`;
function render() {
  authHooks.stateCursor = authHooks.effectCursor = 0;
  expect(SignedOutRedirectRunner()).toBeNull();
  authHooks.passive.splice(0).forEach((commit) => commit());
}
beforeEach(() => {
  resetAuthHooks();
  state.isLoaded = state.online = true;
  state.isSignedIn = false;
  state.activeUserId = null;
  state.pathname = "/app/admin/pdf-reports";
  state.search = new URLSearchParams(query);
  state.router.replace.mockClear();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  authHooks.effects.forEach((effect) => effect.cleanup?.());
  vi.unstubAllGlobals();
});
it("retains the exact report/export/cursors before normal sign-in without a report read", () => {
  render();
  expect(state.router.replace).toHaveBeenCalledExactlyOnceWith(
    `/sign-in?redirect_url=${encodeURIComponent(target)}`,
  );
  expect(fetch).not.toHaveBeenCalled();
});
it("uses the current same-path query and then the generic destination after navigation", () => {
  render();
  render();
  expect(state.router.replace).toHaveBeenCalledTimes(1);
  state.search = new URLSearchParams(query.replace("after-56", "after-4"));
  render();
  expect(state.router.replace).toHaveBeenNthCalledWith(
    2,
    `/sign-in?redirect_url=${encodeURIComponent(target.replace("after-56", "after-4"))}`,
  );
  state.pathname = "/app/library";
  render();
  expect(state.router.replace).toHaveBeenNthCalledWith(3, "/sign-in");
});
it.each([
  { online: false },
  { isLoaded: false },
  { isSignedIn: undefined },
  { isSignedIn: true },
  { activeUserId: "remembered-reader" },
])("keeps the existing signed-out gate for %j", (patch) => {
  Object.assign(state, patch);
  render();
  expect(state.router.replace).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("waits through pending readiness and remembered-account cleanup, using only the latest target", () => {
  state.online = state.isLoaded = false;
  state.isSignedIn = undefined;
  state.activeUserId = "remembered-reader";
  render();
  state.online = state.isLoaded = true;
  state.isSignedIn = false;
  render();
  expect(state.router.replace).not.toHaveBeenCalled();
  state.search = new URLSearchParams(query.replace("after-56", "after-8"));
  state.activeUserId = null;
  render();
  expect(state.router.replace).toHaveBeenCalledExactlyOnceWith(
    `/sign-in?redirect_url=${encodeURIComponent(target.replace("after-56", "after-8"))}`,
  );
});
it.each([
  "/app",
  "/app/library",
  "/app/read/book",
  "/app/admin/pdf-reports-other",
  "https://outside.invalid/app/admin/pdf-reports",
  "//outside.invalid",
  "javascript:alert(1)",
  null,
])("keeps non-report or unknown pathname %s generic", (pathname) => {
  state.pathname = pathname;
  render();
  expect(state.router.replace).toHaveBeenCalledExactlyOnceWith("/sign-in");
});
it.each([
  "kind=conversionId&reference=pdf-1&reference=pdf-2",
  "kind=conversionId&reference=pdf-1&unknown=value",
  "kind=conversionId&reference=pdf-1&view=unknown",
  "kind=operationId&reference=pdf-1&view=export",
  "kind=conversionId&reference=sk-private",
  "kind=conversionId&reference=https%3A%2F%2Foutside.invalid",
  "kind=conversionId&reference=pdf-1&eventCursor=sk-private",
  "kind=conversionId&reference=pdf-1&costCursor=Bearer-private",
  "kind=conversionId&reference=pdf-1&eventCursor=one&eventCursor=two",
  "kind=conversionId&reference=pdf-1&redirect_url=https%3A%2F%2Foutside.invalid",
])("does not carry malformed or unsafe report query %s into auth", (search) => {
  state.search = new URLSearchParams(search);
  render();
  expect(state.router.replace).toHaveBeenCalledExactlyOnceWith("/sign-in");
});
it("keeps an unavailable query hook generic", () => {
  state.search = null;
  render();
  expect(state.router.replace).toHaveBeenCalledExactlyOnceWith("/sign-in");
});
it("retains the bare report search page as a safe report destination", () => {
  state.search = new URLSearchParams();
  render();
  expect(state.router.replace).toHaveBeenCalledExactlyOnceWith(
    `/sign-in?redirect_url=${encodeURIComponent("/app/admin/pdf-reports")}`,
  );
});
