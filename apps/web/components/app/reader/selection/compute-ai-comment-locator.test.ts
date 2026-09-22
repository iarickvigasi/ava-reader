import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeAiCommentLocator } from "./compute-ai-comment-locator";

class MockElement {
  nodeType = 1;
  parentNode = null;
  tagName = "P";
  constructor(public dataset: Record<string, string>) {}
  contains() {
    return true;
  }
  ownerDocument = {
    createRange: () => {
      let value = "";
      return {
        setStart() {},
        setEnd(node: { text: string }, offset: number) {
          value = node.text.slice(0, offset);
        },
        toString: () => value,
      };
    },
  };
}

function textNode(parentNode: MockElement, text: string) {
  return { nodeType: 3, parentNode, text } as unknown as Node;
}

describe("selection locators across sentence fragments", () => {
  beforeEach(() => {
    vi.stubGlobal("HTMLElement", MockElement);
    vi.stubGlobal("Node", { ELEMENT_NODE: 1 });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("anchors both endpoints to absolute offsets even when fragments repeat a block ID", () => {
    const start = new MockElement({
      blockId: "b",
      chapterId: "c",
      readerStartOffset: "100",
    });
    const end = new MockElement({
      blockId: "b",
      chapterId: "c",
      readerStartOffset: "130",
    });
    const range = {
      startContainer: textNode(start, "😀 starts"),
      startOffset: 3,
      endContainer: textNode(end, "later end"),
      endOffset: 5,
    } as Range;
    expect(computeAiCommentLocator(range, "fallback")).toEqual({
      chapterId: "c",
      startBlockId: "b",
      startOffset: 103,
      endBlockId: "b",
      endOffset: 135,
      contextBefore: "",
      contextAfter: "",
    });
  });

  it("keeps original full-block selection offsets unchanged", () => {
    const parent = new MockElement({ blockId: "b", chapterId: "c" });
    const node = textNode(parent, "original words");
    const locator = computeAiCommentLocator(
      {
        startContainer: node,
        endContainer: node,
        startOffset: 1,
        endOffset: 8,
      } as Range,
      "fallback",
    );
    expect(locator).toMatchObject({ startOffset: 1, endOffset: 8 });
  });

  it("never turns translation-only text into a source locator", () => {
    const node = textNode(new MockElement({}), "translated words");
    expect(
      computeAiCommentLocator(
        {
          startContainer: node,
          endContainer: node,
          startOffset: 0,
          endOffset: 5,
        } as Range,
        "c",
      ),
    ).toBeNull();
  });
});
