import { describe, expect, it, vi } from "vitest";
import { sourceOffsetWithin } from "./source-offset-within";

function blockWithProbe(text: string, readerStartOffset?: string) {
  const probe = { setStart: vi.fn(), setEnd: vi.fn(), toString: () => text };
  const block = {
    contains: () => true,
    dataset: { readerStartOffset },
    ownerDocument: { createRange: () => probe },
  } as unknown as HTMLElement;
  return { block, probe };
}

describe("source selection offsets", () => {
  it("adds the sentence's block offset after counting mixed DOM text in UTF-16", () => {
    const { block, probe } = blockWithProbe("A 😀", "125");
    const target = {} as Node;
    expect(sourceOffsetWithin(block, target, 2)).toBe(129);
    expect(probe.setStart).toHaveBeenCalledWith(block, 0);
    expect(probe.setEnd).toHaveBeenCalledWith(target, 2);
  });

  it("preserves ordinary reader offsets with no fragment start attribute", () => {
    const { block } = blockWithProbe("local text");
    expect(sourceOffsetWithin(block, {} as Node, 1)).toBe(10);
  });

  it("ignores invalid fragment offsets and rejects detached DOM points", () => {
    for (const invalid of ["NaN", "-1", "1.5", "Infinity"]) {
      expect(
        sourceOffsetWithin(blockWithProbe("abc", invalid).block, {} as Node, 0),
      ).toBe(3);
    }
    const { block, probe } = blockWithProbe("");
    probe.setEnd.mockImplementation(() => {
      throw new Error("detached");
    });
    expect(sourceOffsetWithin(block, {} as Node, 0)).toBeNull();
    expect(
      sourceOffsetWithin(
        { ...block, contains: () => false } as unknown as HTMLElement,
        {} as Node,
        0,
      ),
    ).toBeNull();
  });
});
