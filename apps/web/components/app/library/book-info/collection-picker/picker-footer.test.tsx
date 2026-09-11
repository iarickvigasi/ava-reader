import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { PickerFooter } from "./picker-footer";
import { createPicker } from "./picker-test-fixture";

describe("collection picker footer", () => {
  it("offers the library instead of a save action when no collections exist", () => {
    const html = renderToStaticMarkup(withIntl(<PickerFooter picker={createPicker()} />));
    expect(html).toContain('href="/app/library"');
    expect(html).toContain("Go to library");
    expect(html).toContain("Close");
    expect(html).not.toContain("Save changes");
  });

  it("disables unchanged saves and explains local saving while offline", () => {
    const picker = createPicker({ online: false, collections: [{
      id: "favorites", name: "Favorites", slug: "favorites", kind: "CUSTOM", smartKey: null,
      description: null, books: [], itemCount: 0, unreadCount: 0,
    }] });
    const html = renderToStaticMarkup(withIntl(<PickerFooter picker={picker} />));
    expect(html).toMatch(/type="submit"[^>]*disabled=""/);
    expect(html).toContain("Changes will sync when you’re back online.");
    const changed = renderToStaticMarkup(withIntl(<PickerFooter picker={{ ...picker, dirty: true }} />));
    expect(changed).not.toMatch(/type="submit"[^>]*disabled=""/);
  });
});
