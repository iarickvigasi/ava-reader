import type { DefaultTreeAdapterMap } from "parse5";
type Node = DefaultTreeAdapterMap["node"];
export function nodes(node: Node): DefaultTreeAdapterMap["element"][] {
  return [
    ...("tagName" in node ? [node] : []),
    ...("childNodes" in node ? node.childNodes.flatMap(nodes) : []),
  ];
}
export function text(node: Node): string {
  return "value" in node
    ? node.value
    : "childNodes" in node
      ? node.childNodes.map(text).join("")
      : "";
}
export const attr = (node: DefaultTreeAdapterMap["element"], name: string) =>
  node.attrs.find((a) => a.name === name)?.value;
