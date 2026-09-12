const BLOCK = "li,[data-reader-block],p,h1,h2,h3,h4,h5,h6,blockquote";
const HARD_BREAK = "br,img,hr,svg,canvas,video,audio";

type TextRun = { node: Text; start: number; end: number };

// Join formatting runs without changing DOM/locator offsets. Synthetic newlines
// keep a word from crossing a hard break, image, or adjacent list item.
export function textContextFromCaret(
  container: HTMLElement,
  caret: Range,
): { text: string; offset: number; runs: TextRun[] } | null {
  const target = caret.startContainer;
  const element =
    target.nodeType === Node.ELEMENT_NODE
      ? (target as Element)
      : target.parentElement;
  const nearest = element?.closest(BLOCK);
  const root = nearest && container.contains(nearest) ? nearest : container;
  const runs: TextRun[] = [];
  let text = "";
  let offset: number | null = null;

  function visit(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const data = (node as Text).data;
      if (node === target) offset = text.length + caret.startOffset;
      if (data) {
        runs.push({
          node: node as Text,
          start: text.length,
          end: text.length + data.length,
        });
      }
      text += data;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const child = node as Element;
    if (child.matches(HARD_BREAK)) {
      text += "\n";
      return;
    }
    const isBlock = node !== root && child.matches(BLOCK);
    if (isBlock) text += "\n";
    node.childNodes.forEach((descendant, index) => {
      if (node === target && index === caret.startOffset) offset = text.length;
      visit(descendant);
    });
    if (node === target && caret.startOffset === node.childNodes.length) {
      offset = text.length;
    }
    if (isBlock) text += "\n";
  }

  visit(root);
  return offset === null ? null : { text, offset, runs };
}
