import { describe, expect, it } from "vitest";
import type { ReaderBlock } from "@/lib/api-types";
import { resolveBlockStyle } from "./reader-block-style";

function heading(extra: Partial<Extract<ReaderBlock, { kind: "heading" }>> = {}): ReaderBlock {
  return { id: "heading", kind: "heading", level: 1, text: "Title", inlines: [], ...extra };
}

describe("source heading size", () => {
  it("uses the prose baseline for an explicitly measured canonical heading", () => {
    expect(resolveBlockStyle(heading({
      canonical: true,
      presentation: { id: "source", relative_size: 3, bold: false },
    }))).toEqual({
      "--reader-block-scale": 3,
      "--reader-heading-base-small": "1.16rem",
      "--reader-heading-base-large": "1.34rem",
      fontWeight: 400,
    });
  });

  it("retains semantic heading defaults when source size is unknown", () => {
    expect(resolveBlockStyle(heading({
      canonical: true,
      presentation: { id: "source", relative_size: null, bold: false },
    }))).toEqual({ fontWeight: 400 });
  });

  it("preserves ordinary EPUB heading scale and explicit publisher size", () => {
    expect(resolveBlockStyle(heading({ fontSizeScale: 1.2 }))).toEqual({
      "--reader-block-scale": 1.2,
    });
  });
});
