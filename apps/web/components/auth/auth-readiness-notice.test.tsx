import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { AuthReadinessNotice } from "./auth-readiness-notice";

it("shows bounded bootstrap or stalled recovery with a normal named reload action", () => {
  const loading = renderToStaticMarkup(
    withIntl(<AuthReadinessNotice readiness="loading" />),
  );
  expect(loading).toContain("Preparing sign-in");
  expect(loading).not.toContain(">Reload<");
  for (const props of [
    { readiness: "unavailable" as const },
    { readiness: "ready" as const, operation: "timed-out" as const },
  ]) {
    const result = renderToStaticMarkup(
      withIntl(<AuthReadinessNotice {...props} />),
    );
    expect(result).toContain('role="status"');
    expect(result).toContain(">Reload<");
    expect(result).toContain('type="button"');
  }
});

it("exposes returned/thrown provider errors even while the email panel is closed", () => {
  const result = renderToStaticMarkup(
    withIntl(<AuthReadinessNotice readiness="ready" error="Sign-in failed" />),
  );
  expect(result).toContain('data-auth-readiness="error"');
  expect(result).toContain('role="alert"');
  expect(result).toContain("Sign-in failed");
  expect(result).not.toContain(">Reload<");
});
