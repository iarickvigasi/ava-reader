import type { MouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { activateInternalLink } from "./activate-internal-link";

const target = { chapterId: "notes", blockId: "cell", textOffset: 3 };
describe("internal image activation", () => {
  it.each([
    ["paragraph", 4],
    ["figure", 0],
    ["nested-list-item", 2],
  ])(
    "jumps from %s with the exact return position",
    (blockId, sourceOffset) => {
      const preventDefault = vi.fn(),
        jump = vi.fn(),
        closest = vi.fn(() => ({ dataset: { chapterId: "body", blockId } }));
      const event = {
        preventDefault,
        currentTarget: { closest },
      } as unknown as MouseEvent<HTMLAnchorElement>;
      activateInternalLink(event, { target, sourceOffset, jump });
      expect(preventDefault).toHaveBeenCalledOnce();
      expect(closest).toHaveBeenCalledWith("[data-reader-block='true']");
      expect(jump).toHaveBeenCalledExactlyOnceWith(target, {
        chapterId: "body",
        blockId,
        textOffset: sourceOffset,
      });
    },
  );
  it("prevents raw navigation when a live reader context is unavailable", () => {
    const preventDefault = vi.fn(),
      jump = vi.fn();
    activateInternalLink(
      {
        preventDefault,
        currentTarget: { closest: () => null },
      } as unknown as MouseEvent<HTMLAnchorElement>,
      { target, sourceOffset: 0, jump },
    );
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(jump).not.toHaveBeenCalled();
  });
});
