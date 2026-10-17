import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { EmailCodePanel } from "./email-code-panel";
const noop = vi.fn();
const props = {
  mode: "sign-in" as const,
  stage: "identifier" as const,
  email: "reader@example.test",
  code: "",
  onEmailChange: noop,
  onCodeChange: noop,
  onBack: noop,
  onSubmitIdentifier: noop,
  onSubmitCode: noop,
  onResendCode: noop,
};
it("keeps bootstrap form edits/Back usable while submission stays disabled", () => {
  const html = renderToStaticMarkup(
    withIntl(<EmailCodePanel {...props} busy={false} disabled />),
  );
  expect(html).not.toMatch(/<input[^>]*\sdisabled=""/);
  expect(html).toContain("Send code");
  expect(html).not.toContain("Sending");
  expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Send code/);
  expect(html).toMatch(/<button(?![^>]*\sdisabled=)[^>]*>Back/);
});
it("freezes identifier/Back while a request is in flight", () => {
  const html = renderToStaticMarkup(
    withIntl(<EmailCodePanel {...props} busy interactionLocked />),
  );
  expect(html).toMatch(/<input[^>]*\sdisabled=""/);
  expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Back/);
});
