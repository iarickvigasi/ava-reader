import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { PickerContent } from "./picker-content";
import { createPicker } from "./picker-test-fixture";

describe("collection picker content", () => {
  it("explains how to create a collection when no custom collections exist", () => {
    const html = renderToStaticMarkup(withIntl(<PickerContent picker={createPicker()} />));
    expect(html).toContain("No collections yet");
    expect(html).toContain("Create a collection in your library, then come back to add this book.");
    expect(html).not.toContain('type="checkbox"');
  });

  it("distinguishes an unavailable offline cache from a confirmed empty library", () => {
    const html = renderToStaticMarkup(withIntl(<PickerContent
      picker={createPicker({ unavailable: true, online: false })} />));
    expect(html).toContain("Connect to the internet to load your collections.");
    expect(html).toContain("Try again");
    expect(html).not.toContain("No collections yet");
  });

  it("prechecks membership even when the book is absent from the collection preview", () => {
    const picker = createPicker({ selectedIds: new Set(["favorites"]), collections: [{
      id: "favorites", name: "Favorites", slug: "favorites", kind: "CUSTOM", smartKey: null,
      description: "Stories to return to", books: [], itemCount: 20, unreadCount: 12,
    }] });
    const html = renderToStaticMarkup(withIntl(<PickerContent picker={picker} />));
    expect(html).toMatch(/type="checkbox"[^>]*aria-label="Favorites"[^>]*checked=""/);
    expect(html).toContain("Stories to return to");
  });
});
