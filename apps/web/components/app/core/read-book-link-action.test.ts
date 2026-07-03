import { describe, expect, it, vi } from "vitest";

import { resolveOfflineReadAction } from "./read-book-link-action";

describe("resolveOfflineReadAction", () => {
  it("navigates when the book is cached — reading content state at call time", async () => {
    const hasContent = vi.fn(async () => true);
    const action = await resolveOfflineReadAction("book-1", hasContent);
    expect(action).toBe("navigate");
    // The decision must consult the cache at click time (fresh), not a snapshot.
    expect(hasContent).toHaveBeenCalledWith("book-1");
  });

  it("shows the missing-book modal when the book is not cached", async () => {
    const hasContent = vi.fn(async () => false);
    expect(await resolveOfflineReadAction("book-1", hasContent)).toBe("missing");
  });
});
