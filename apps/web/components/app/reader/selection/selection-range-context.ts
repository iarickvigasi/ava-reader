const CONTEXT_CHAR_COUNT = 30;

export function computeSelectionRangeContext(range: Range) {
  const article = findArticleElement(range.startContainer);
  if (!article) return { contextBefore: "", contextAfter: "" };
  let contextBefore = "";
  let contextAfter = "";
  const beforeRange = article.ownerDocument.createRange();
  try {
    beforeRange.setStart(article, 0);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    contextBefore = beforeRange.toString().slice(-CONTEXT_CHAR_COUNT);
  } catch {
    /* A detached selection has no surrounding context. */
  }
  const afterRange = article.ownerDocument.createRange();
  try {
    afterRange.setStart(range.endContainer, range.endOffset);
    afterRange.setEndAfter(article);
    contextAfter = afterRange.toString().slice(0, CONTEXT_CHAR_COUNT);
  } catch {
    /* A detached selection has no surrounding context. */
  }
  return { contextBefore, contextAfter };
}

function findArticleElement(node: Node): HTMLElement | null {
  let current: Node | null =
    node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;
  while (current) {
    if (current instanceof HTMLElement && current.tagName === "ARTICLE")
      return current;
    current = current.parentNode;
  }
  return null;
}
