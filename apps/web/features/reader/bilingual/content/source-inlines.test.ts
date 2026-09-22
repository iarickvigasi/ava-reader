import { describe, expect, it } from "vitest";
import type { BilingualUnit } from "@/lib/api-types/bilingual";
import type { ReaderBlock, ReaderInline } from "@/lib/api-types/reader";
import { sourceInlinesForUnit } from "./source-inlines";

const paragraph = (inlines: ReaderInline[]): ReaderBlock => ({
  id: "b",
  kind: "paragraph",
  text: "normalized",
  inlines,
});
const unit = (start: number, text: string, itemId?: string): BilingualUnit => ({
  id: "sentence",
  blockId: "b",
  kind: "sentence",
  text,
  startOffset: start,
  endOffset: start + text.length,
  itemId,
});

describe("bilingual source inline slicing", () => {
  it("slices formatted runs without losing links, emphasis, or superscript", () => {
    const block = paragraph([
      { kind: "text", text: "prefix Bold", bold: true },
      {
        kind: "text",
        text: "link",
        href: "#note",
        italic: true,
        fontWeight: 600,
      },
      { kind: "text", text: "2 suffix", script: "super" },
    ]);
    expect(sourceInlinesForUnit(unit(7, "Boldlink2"), block)).toEqual([
      { kind: "text", text: "Bold", bold: true },
      {
        kind: "text",
        text: "link",
        href: "#note",
        italic: true,
        fontWeight: 600,
      },
      { kind: "text", text: "2", script: "super" },
    ]);
  });

  it("uses list-wide raw inline offsets without inserting normalized search newlines", () => {
    const block: ReaderBlock = {
      id: "b",
      kind: "list",
      ordered: true,
      text: "First\nSecond",
      items: [
        {
          id: "one",
          text: "First",
          inlines: [{ kind: "text", text: "First  " }],
        },
        {
          id: "two",
          text: "Second",
          inlines: [{ kind: "text", text: "Second", italic: true }],
        },
      ],
    };
    expect(sourceInlinesForUnit(unit(7, "Second", "two"), block)).toEqual([
      { kind: "text", text: "Second", italic: true },
    ]);
  });

  it("counts emoji and combined Unicode as UTF-16, matching DOM locators", () => {
    const block = paragraph([
      { kind: "text", text: "😀 " },
      { kind: "text", text: "e\u0301 日本語.", bold: true },
    ]);
    expect(sourceInlinesForUnit(unit(3, "e\u0301 日本語."), block)).toEqual([
      { kind: "text", text: "e\u0301 日本語.", bold: true },
    ]);
  });

  it("keeps an inline image once at boundaries and retains a final trailing image", () => {
    const leading: ReaderInline = {
      kind: "image",
      src: "start.png",
      alt: "start",
    };
    const middle: ReaderInline = {
      kind: "image",
      src: "middle.png",
      alt: "middle",
      href: "#figure",
    };
    const trailing: ReaderInline = {
      kind: "image",
      src: "end.png",
      alt: "end",
    };
    const block = paragraph([
      leading,
      { kind: "text", text: "One. " },
      middle,
      { kind: "text", text: "Two." },
      trailing,
    ]);
    expect(sourceInlinesForUnit(unit(0, "One. "), block)).toEqual([
      leading,
      { kind: "text", text: "One. " },
    ]);
    expect(sourceInlinesForUnit(unit(5, "Two."), block)).toEqual([
      middle,
      { kind: "text", text: "Two." },
      trailing,
    ]);
  });

  it("retains images within a sentence without counting their alt text", () => {
    const image: ReaderInline = {
      kind: "image",
      src: "formula.png",
      alt: "an entire formula",
    };
    const block = paragraph([
      { kind: "text", text: "See " },
      image,
      { kind: "text", text: " here." },
    ]);
    expect(sourceInlinesForUnit(unit(0, "See  here."), block)).toEqual(
      block.kind === "paragraph" ? block.inlines : [],
    );
  });

  it("falls back to exact unit text when a block, item, or its canonical text mismatches", () => {
    const sentence = unit(0, "Canonical.");
    const fallback = [{ kind: "text", text: "Canonical." }];
    expect(sourceInlinesForUnit(sentence)).toEqual(fallback);
    expect(
      sourceInlinesForUnit(
        sentence,
        paragraph([{ kind: "text", text: "Different." }]),
      ),
    ).toEqual(fallback);
    expect(
      sourceInlinesForUnit(sentence, { ...paragraph([]), id: "other" }),
    ).toEqual(fallback);
    expect(
      sourceInlinesForUnit(sentence, {
        id: "b",
        kind: "list",
        text: "",
        ordered: false,
        items: [],
      }),
    ).toEqual(fallback);
  });
});
