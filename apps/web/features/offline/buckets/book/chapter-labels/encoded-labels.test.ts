import { expect, it } from "vitest";
import { hasLegacyLabels, patchLegacyLabels } from "./patch-labels";
import { tocNode } from "./fixture";

it.each(["&#x2019;", "&#8217;", "&#X2019;"])(
  "refreshes encoded apostrophes: %s",
  (entity) => {
    const cached = {
      ...tocNode,
      label: `The Parable of the Cow${entity}s Tail`,
    };
    const source = { ...tocNode, label: "The Parable of the Cow’s Tail" };
    expect(hasLegacyLabels([cached])).toBe(true);
    expect(patchLegacyLabels([cached], [source])).toEqual([source]);
    expect(hasLegacyLabels([source])).toBe(false);
  },
);

it("matches nested section nodes rather than replacing them with the chapter title", () => {
  const child = {
    ...tocNode,
    id: "section",
    anchorId: "tail",
    blockId: "b2",
    href: "chapter.xhtml#tail",
    label: "Cow&#x2019;s Tail",
  };
  const cached = [{ ...tocNode, label: "Parables", children: [child] }];
  const source = [
    { ...cached[0], children: [{ ...child, label: "Cow’s Tail" }] },
  ];
  expect(patchLegacyLabels(cached, source)).toEqual(source);
  expect(
    patchLegacyLabels(cached, [{ ...source[0], children: [] }]),
  ).toBeNull();
  expect(
    patchLegacyLabels(cached, [
      {
        ...source[0],
        children: [{ ...source[0].children[0], anchorId: "other" }],
      },
    ]),
  ).toBeNull();
});

it("refreshes encoded group labels with no chapter and preserves unresolved references", () => {
  const cached = {
    ...tocNode,
    chapterId: null,
    spineIndex: null,
    label: "Love &amp; Life",
  };
  const source = { ...cached, label: "Love & Life" };
  expect(patchLegacyLabels([cached], [source])).toEqual([source]);
  expect(patchLegacyLabels([cached], [cached])).toBeNull();
  expect(hasLegacyLabels([{ ...tocNode, label: "Literal &nbsp;" }])).toBe(
    false,
  );
});
