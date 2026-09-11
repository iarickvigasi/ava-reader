import { describe, expect, it } from "vitest";
import { selectDraftMemberships } from "./select-draft-memberships";

describe("collection picker draft during background refresh", () => {
  it("adopts fresh membership for untouched collections", () => {
    expect([...selectDraftMemberships(new Set(["fresh"]), {})]).toEqual(["fresh"]);
  });

  it("preserves explicit checks and unchecks while other memberships refresh", () => {
    const result = selectDraftMemberships(new Set(["removed", "fresh"]), {
      removed: false, added: true,
    });
    expect([...result].sort()).toEqual(["added", "fresh"]);
  });
});
