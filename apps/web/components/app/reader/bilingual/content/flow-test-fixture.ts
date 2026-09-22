import { parseFragment } from "parse5";
import type {
  BilingualChapter,
  BilingualUnit,
} from "@/lib/api-types/bilingual";
import type { ReaderBlock } from "@/lib/api-types/reader";

export const flowBlocks: ReaderBlock[] = [
  {
    id: "p",
    kind: "paragraph",
    text: "One. Two.",
    textIndent: 2,
    fontSizeScale: 1.2,
    fontWeight: 500,
    align: "justify",
    inlines: [
      { kind: "text", text: "One. " },
      { kind: "text", text: "Two.", bold: true },
    ],
  },
  {
    id: "q",
    kind: "blockquote",
    text: "Quote.",
    inlines: [{ kind: "text", text: "Quote." }],
  },
  {
    id: "l",
    kind: "list",
    ordered: true,
    text: "First. Again.\nSecond.",
    items: [
      {
        id: "i1",
        text: "First. Again.",
        inlines: [{ kind: "text", text: "First. Again." }],
      },
      {
        id: "i2",
        text: "Second.",
        inlines: [{ kind: "text", text: "Second." }],
      },
    ],
  },
  {
    id: "image",
    kind: "image",
    text: "",
    alt: "Illustration",
    src: "blob:illustration",
  },
];

function sentence(
  id: string,
  blockId: string,
  text: string,
  startOffset: number,
  itemId?: string,
): BilingualUnit {
  return {
    id,
    blockId,
    text,
    startOffset,
    endOffset: startOffset + text.length,
    itemId,
    kind: "sentence",
  };
}

export const flowChapter: BilingualChapter = {
  libraryItemId: "book",
  chapterId: "chapter",
  contentRevision: "r1",
  translationVersion: 1,
  targetLang: "es",
  translations: {
    one: " Uno. ",
    two: " Dos. ",
    quote: " Cita. ",
    first: "Primero.",
    again: "Otra vez.",
    second: "Segundo.",
  },
  units: [
    sentence("one", "p", "One. ", 0),
    sentence("two", "p", "Two.", 5),
    sentence("quote", "q", "Quote.", 0),
    sentence("first", "l", "First. ", 0, "i1"),
    sentence("again", "l", "Again.", 7, "i1"),
    sentence("second", "l", "Second.", 13, "i2"),
    {
      id: "img",
      blockId: "image",
      text: "",
      startOffset: 0,
      endOffset: 0,
      kind: "image",
    },
  ],
};

type MarkupNode = {
  nodeName: string;
  value?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: unknown[];
};
export function markupNodes(html: string, tag: string): MarkupNode[] {
  function collect(node: MarkupNode): MarkupNode[] {
    return [
      ...(node.nodeName === tag ? [node] : []),
      ...(node.childNodes ?? []).flatMap((child) =>
        collect(child as MarkupNode),
      ),
    ];
  }
  return collect(parseFragment(html));
}
export function markupText(node: MarkupNode): string {
  return node.nodeName === "#text"
    ? (node.value ?? "")
    : (node.childNodes ?? [])
        .map((child) => markupText(child as MarkupNode))
        .join("");
}
export function attribute(node: MarkupNode, name: string) {
  return node.attrs?.find((attr) => attr.name === name)?.value;
}
