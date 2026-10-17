import { afterEach, expect, it, vi } from "vitest";
import {
  beginDeviceTransition,
  finishDeviceTransition,
  isDeviceTransitionPending,
} from "./device-transition";

const report =
  "/app/admin/pdf-reports?kind=conversionId&reference=pdf-authored&view=export&eventCursor=events-56&costCursor=cost-4";
function run(href: string) {
  const replace = vi.fn(),
    setItem = vi.fn();
  vi.stubGlobal("window", { location: { href, replace } });
  vi.stubGlobal("sessionStorage", {
    setItem,
    getItem: () => null,
    removeItem: vi.fn(),
  });
  beginDeviceTransition();
  expect(isDeviceTransitionPending()).toBe(true);
  // The existing marker retains no URL, user identity or session credentials.
  expect(setItem).toHaveBeenCalledExactlyOnceWith(
    "ava-reader:identity-transition",
    "1",
  );
  return replace;
}
afterEach(() => {
  finishDeviceTransition();
  vi.unstubAllGlobals();
});
it.each([
  `https://ava.invalid${report}`,
  `https://ava.invalid/sign-in?redirect_url=${encodeURIComponent(report)}`,
  `https://ava.invalid/auth/sso-callback?redirect_url=${encodeURIComponent(report)}`,
  `https://ava.invalid/sign-in?notice=oauth_continue&redirect_url=${encodeURIComponent(report)}`,
])("hard-reloads only the validated current report (%#)", (href) => {
  expect(run(href)).toHaveBeenCalledExactlyOnceWith(report);
});
it.each([
  "https://ava.invalid/app/read/book",
  "https://ava.invalid/sign-up",
  "https://ava.invalid/sign-in",
  `https://ava.invalid/other?redirect_url=${encodeURIComponent(report)}`,
  `https://ava.invalid/sign-in?redirect_url=${encodeURIComponent(report)}&redirect_url=${encodeURIComponent(report)}`,
  `https://ava.invalid/auth/sso-callback?redirect_url=${encodeURIComponent(report)}&unknown=private`,
  `https://ava.invalid/sign-in?redirect_url=${encodeURIComponent(report)}&notice=other`,
  "https://ava.invalid/sign-in?redirect_url=https://foreign.invalid/app/admin/pdf-reports",
  "https://ava.invalid/auth/sso-callback?redirect_url=%2F%2Fforeign.invalid",
  `https://ava.invalid${report}&unknown=private`,
  `https://ava.invalid${report}&reference=other`,
  `https://ava.invalid${report.replace("pdf-authored", "sk-private")}`,
  `https://ava.invalid${report.replace("events-56", "sk-private")}`,
  `https://ava.invalid${report.replace("cost-4", "Bearer-private")}`,
  `https://ava.invalid${report}&__clerk_handshake=private`,
  `https://ava.invalid${report}#private`,
  `https://authored:private@ava.invalid${report}`,
  "javascript:private",
  "invalid",
])("keeps malformed, credential or other-flow reloads at Home (%#)", (href) => {
  expect(run(href)).toHaveBeenCalledExactlyOnceWith("/app");
});
