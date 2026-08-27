import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PendingLabel } from "./pending-label";

const render = (pending: boolean) =>
  renderToStaticMarkup(
    <PendingLabel pending={pending} pendingText="Opening">
      Read
    </PendingLabel>,
  );

describe("PendingLabel", () => {
  it("keeps both labels mounted so the control width stays stable", () => {
    const html = render(false);
    expect(html).toContain("Read");
    expect(html).toContain("Opening");
  });

  it("renders the dots right after the pending text, sitting on its baseline", () => {
    const html = render(true);
    // The pending layer is baseline-aligned and its text is immediately
    // followed by the dots icon — an animated ellipsis, not a leading icon.
    expect(html).toMatch(
      /class="[^"]*items-baseline[^"]*"[^>]*>Opening<span aria-hidden="true"/,
    );
  });

  it("hides the pending layer from assistive tech while idle", () => {
    const html = render(false);
    expect(html).toContain('aria-busy="false"');
    // The pending layer is the only aria-hidden element carrying an opacity
    // class (the dots icon is aria-hidden but has no opacity class).
    expect(html).toMatch(/aria-hidden="true"[^>]*class="[^"]*opacity-0/);
    expect(html).not.toMatch(/aria-hidden="true"[^>]*>Read/);
  });

  it("shows dots + pending text and hides the idle label while pending", () => {
    const html = render(true);
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/aria-hidden="true"[^>]*>Read/);
    expect(html.match(/ava-dot-pulse/g)).toHaveLength(3);
    expect(html).not.toMatch(/aria-hidden="true"[^>]*>[^<]*Opening/);
  });
});
