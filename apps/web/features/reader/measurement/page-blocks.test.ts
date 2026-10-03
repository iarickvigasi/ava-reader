import { expect, it } from "vitest";
import { pageLocatorBlocks } from "./page-blocks";

function block(id: string, kind: string, child = false) {
  return {
    dataset: { blockId: id, readerBlockKind: kind },
    querySelector: () => (child ? {} : null),
  } as unknown as HTMLElement;
}
it("selects table cells for progress while retaining standalone figures and list leaves", () => {
  const table = block("table", "image", true);
  const cell = block("cell-on-later-page", "paragraph");
  const figure = block("figure", "image");
  const listItem = block("nested-list-item", "paragraph");
  const article = {
    querySelectorAll: () => [table, cell, figure, listItem],
  } as unknown as HTMLElement;
  expect(pageLocatorBlocks(article)).toEqual([cell, figure, listItem]);
});
