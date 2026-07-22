import { describe, expect, it, vi } from "vitest";
import { resolveReaderSelection } from "./resolve-reader-selection";

describe("resolveReaderSelection", () => {
  it("returns a trimmed selection wholly inside the reader", () => {
    const commonAncestorContainer = {} as Node;
    const range = { commonAncestorContainer } as Range;
    const selection = {
      getRangeAt: vi.fn(() => range),
      isCollapsed: false,
      rangeCount: 1,
      toString: () => "  selected text  ",
    } as unknown as Selection;
    const container = {
      contains: vi.fn(() => true),
    } as unknown as HTMLElement;

    expect(resolveReaderSelection(selection, container)).toEqual({
      range,
      text: "selected text",
    });
    expect(container.contains).toHaveBeenCalledWith(commonAncestorContainer);
  });

  it("rejects collapsed, empty, and out-of-reader selections", () => {
    const range = { commonAncestorContainer: {} as Node } as Range;
    const container = {
      contains: vi.fn(() => false),
    } as unknown as HTMLElement;

    expect(
      resolveReaderSelection(
        {
          getRangeAt: vi.fn(() => range),
          isCollapsed: true,
          rangeCount: 1,
          toString: () => "selected text",
        } as unknown as Selection,
        container,
      ),
    ).toBeNull();

    expect(
      resolveReaderSelection(
        {
          getRangeAt: vi.fn(() => range),
          isCollapsed: false,
          rangeCount: 1,
          toString: () => "   ",
        } as unknown as Selection,
        container,
      ),
    ).toBeNull();

    expect(
      resolveReaderSelection(
        {
          getRangeAt: vi.fn(() => range),
          isCollapsed: false,
          rangeCount: 1,
          toString: () => "selected text",
        } as unknown as Selection,
        container,
      ),
    ).toBeNull();
  });
});
