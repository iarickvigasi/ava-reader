import { describe, expect, it } from "vitest";
import type { ReaderBlock } from "@/lib/api-types";
import type { ReaderBlockBase } from "@/lib/api-types/reader-blocks";
import { resolveBlockStyle } from "./reader-block-style";

function heading(
  extra: Partial<Extract<ReaderBlock, { kind: "heading" }>> = {},
): ReaderBlock {
  return {
    id: "heading",
    kind: "heading",
    level: 1,
    text: "Title",
    inlines: [],
    ...extra,
  };
}

describe("source heading size", () => {
  it("uses the prose baseline for an explicitly measured canonical heading", () => {
    expect(
      resolveBlockStyle(
        heading({
          canonical: true,
          presentation: { id: "source", relative_size: 3, bold: false },
        }),
      ),
    ).toEqual({
      "--reader-block-scale": 3,
      "--reader-heading-base-small": "1.16rem",
      "--reader-heading-base-large": "1.34rem",
      fontWeight: 400,
    });
  });

  it("retains semantic heading defaults when source size is unknown", () => {
    expect(
      resolveBlockStyle(
        heading({
          canonical: true,
          presentation: { id: "source", relative_size: null, bold: false },
        }),
      ),
    ).toEqual({ fontWeight: 400 });
  });

  it("preserves ordinary EPUB heading scale and explicit publisher size", () => {
    expect(resolveBlockStyle(heading({ fontSizeScale: 1.2 }))).toEqual({
      "--reader-block-scale": 1.2,
    });
  });
});

function paragraph(extra: Partial<ReaderBlockBase> = {}): ReaderBlock {
  return {
    id: "body",
    kind: "paragraph",
    text: "A source paragraph",
    inlines: [],
    ...extra,
  };
}

describe("paragraph indentation fidelity", () => {
  it("does not invent indentation for an unknown canonical source", () => {
    const presentation = { id: "unknown", indent_em: null };
    expect(
      resolveBlockStyle(paragraph({ canonical: true, presentation })),
    ).toBeUndefined();
    expect(presentation.indent_em).toBeNull();
  });
  it.each([0, 1.5, -0.75])(
    "preserves canonical first-line indentation %s",
    (indent) => {
      expect(
        resolveBlockStyle(
          paragraph({
            canonical: true,
            presentation: {
              id: "observed",
              indent_em: indent,
              block_indent_em: 1,
            },
          }),
        ),
      ).toEqual({ textIndent: `${indent}em`, marginInlineStart: "1em" });
    },
  );
  it("preserves ordinary EPUB defaults and signed publisher indentation", () => {
    expect(resolveBlockStyle(paragraph())).toEqual({ textIndent: "1.5em" });
    expect(resolveBlockStyle(paragraph({ textIndent: 0 }))).toBeUndefined();
    expect(resolveBlockStyle(paragraph({ textIndent: -0.5 }))).toEqual({
      textIndent: "-0.5em",
    });
  });
});
