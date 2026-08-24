import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SelectionQuote } from "./selection-quote";

const LONG_FRAGMENT =
  "a fragment long enough that a single strip line could never hold it";

function render(props: Parameters<typeof SelectionQuote>[0]) {
  return renderToStaticMarkup(<SelectionQuote {...props} />);
}

describe("SelectionQuote", () => {
  it("collapsed: truncates to one line but keeps the full text in the markup", () => {
    const markup = render({
      text: LONG_FRAGMENT,
      isExpanded: false,
      onToggle: vi.fn(),
    });
    // Screen readers must get the whole fragment even while visually clipped.
    expect(markup).toContain(LONG_FRAGMENT);
    expect(markup).toContain("truncate");
    expect(markup).toContain('aria-expanded="false"');
  });

  it("expanded: wraps the full fragment instead of truncating", () => {
    const markup = render({
      text: LONG_FRAGMENT,
      isExpanded: true,
      onToggle: vi.fn(),
    });
    expect(markup).not.toContain("truncate");
    expect(markup).toContain("break-words");
    expect(markup).toContain('aria-expanded="true"');
  });
});
