import { expect, it } from "vitest";
import { hasLegacyLabels, patchLegacyLabels } from "./patch-labels";
import { tocNode } from "./fixture";

it("patches nested legacy labels and preserves authored names and anchors", () => {
  const original = [{ ...tocNode, label: "Contents", children: [tocNode] }];
  const result = patchLegacyLabels(original, [
    { ...tocNode, label: "1. Opening…" },
  ]);
  expect(result).toEqual([
    { ...original[0], children: [{ ...tocNode, label: "1. Opening…" }] },
  ]);
  expect(hasLegacyLabels(result!)).toBe(false);
  expect(original[0].children[0].label).toBe("Chapter 1");
});

it("accepts number-only labels and rejects mismatched chapter identities", () => {
  expect(
    patchLegacyLabels([tocNode], [{ ...tocNode, label: "1." }])?.[0].label,
  ).toBe("1.");
  expect(
    patchLegacyLabels(
      [tocNode],
      [{ ...tocNode, chapterId: "changed", label: "1." }],
    ),
  ).toBeNull();
  expect(
    patchLegacyLabels([tocNode], [{ ...tocNode, spineIndex: 2, label: "3." }]),
  ).toBeNull();
  expect(
    patchLegacyLabels([tocNode], [{ ...tocNode, label: "Chapter 1" }]),
  ).toBeNull();
});
