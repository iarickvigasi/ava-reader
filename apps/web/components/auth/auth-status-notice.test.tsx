import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { AuthStatusNotice } from "./auth-status-notice";
const notice = vi.hoisted(() => ({
  state: "unavailable",
  visible: true,
  dismiss: vi.fn(),
}));
vi.mock("@/features/auth/use-auth-notice", () => ({
  useAuthNotice: () => notice,
}));
it("renders a named close button for reconnecting and preserves the sign-in action", () => {
  const reconnecting = renderToStaticMarkup(withIntl(<AuthStatusNotice />));
  expect(reconnecting).toContain('aria-label="Close notification"');
  expect(reconnecting).toContain('type="button"');
  notice.state = "sign-in-required";
  const expired = renderToStaticMarkup(withIntl(<AuthStatusNotice />));
  expect(expired).toContain('href="/sign-in"');
  expect(expired).not.toContain('aria-label="Close notification"');
  notice.visible = false;
  expect(renderToStaticMarkup(withIntl(<AuthStatusNotice />))).toBe("");
});
