import { describe, expect, it } from "vitest";
import { groupInlineLinkOccurrences } from "@/features/reader/group-inline-link-occurrences";
import {
  linkedText,
  nodeText,
  renderInlines,
} from "./reader-link-occurrence-fixture";

describe("reader link occurrence identity", () => {
  it("keeps adjacent callers of the same note and their return offsets distinct", () => {
    const target = { ...linkedText().target!, note: true };
    const inlines = [
      linkedText({ target, sourceOffset: 26 }),
      linkedText({ target, spanId: "caller-two", sourceOffset: 40 }),
    ];
    const { anchors } = renderInlines(inlines);
    expect(anchors.map(nodeText)).toEqual(["1", "1"]);
    expect(
      anchors.every((node) =>
        node.attrs.some(
          (attr) => attr.name === "role" && attr.value === "doc-noteref",
        ),
      ),
    ).toBe(true);
    const groups = groupInlineLinkOccurrences(inlines);
    expect(
      groups.map(
        (group) => group.kind === "text" && group.inlines[0].sourceOffset,
      ),
    ).toEqual([26, 40]);
  });

  it("keeps adjacent external occurrences distinct even with an equal URL and caller", () => {
    const first = linkedText({
      target: undefined,
      href: "https://example.org/note",
    });
    const second = { ...first, spanId: "caller-two" };
    expect(renderInlines([first, second]).anchors.map(nodeText)).toEqual([
      "1",
      "1",
    ]);
  });

  it.each([
    ["missing occurrence", { spanId: undefined }],
    ["empty occurrence", { spanId: "" }],
    ["whitespace occurrence", { spanId: "  " }],
    ["different caller", { sourceOffset: 5 }],
    [
      "different target offset",
      { target: { ...linkedText().target!, textOffset: 3 } },
    ],
    [
      "different note role",
      { target: { ...linkedText().target!, note: true } },
    ],
    [
      "different destination",
      { target: { ...linkedText().target!, blockId: "other" } },
    ],
    ["different URL", { href: "https://example.org/other" }],
  ])("does not coalesce %s", (_name, changes) => {
    const first = linkedText();
    const second = linkedText(changes);
    const inlines =
      "spanId" in changes ? [second, { ...second }] : [first, second];
    expect(renderInlines(inlines).anchors).toHaveLength(2);
  });

  it("does not group across unlinked text or an image, preserving image position", () => {
    const inlines = [
      linkedText(),
      { kind: "text" as const, text: " / " },
      linkedText(),
    ];
    expect(renderInlines(inlines).anchors.map(nodeText)).toEqual(["1", "1"]);
    const image = {
      kind: "image" as const,
      src: "data:image/png;base64,AA==",
      alt: "Diagram",
      target: linkedText().target,
      sourceOffset: 6,
    };
    const withImage = [linkedText(), image, linkedText()];
    const { anchors, html } = renderInlines(withImage);
    expect(anchors).toHaveLength(3);
    expect(html).toContain('alt="Diagram"');
    expect(
      groupInlineLinkOccurrences(withImage).map((group) => group.sourceIndex),
    ).toEqual([0, 1, 2]);
  });
});
