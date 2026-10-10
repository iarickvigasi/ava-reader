import type { ReaderBlock, ReaderChapterPayload } from "@/lib/api-types";

export function ordinaryReferenceChapter(): ReaderChapterPayload {
  const run = (text: string) => [{ kind: "text" as const, text }];
  const blocks: ReaderBlock[] = [
    {
      kind: "list",
      id: "list",
      anchorId: "notes",
      text: "Outer.\nNested 😀.\nLast.",
      ordered: true,
      start: 3,
      items: [
        {
          id: "outer",
          anchorId: "outer-note",
          text: "Outer.",
          inlines: run("Outer."),
          children: [
            {
              kind: "list",
              id: "nested-list",
              text: "Nested 😀.",
              ordered: false,
              items: [
                {
                  id: "nested",
                  text: "Nested 😀.",
                  inlines: run("Nested 😀."),
                },
              ],
            },
          ],
        },
        { id: "last", text: "Last.", inlines: run("Last.") },
      ],
    },
    {
      kind: "table",
      id: "table",
      text: "Heading.Cell.",
      cells: [
        {
          id: "header",
          row: 0,
          column: 0,
          headerAxis: "column",
          headerIds: [],
          text: "Heading.",
          inlines: run("Heading."),
        },
        {
          id: "cell",
          row: 1,
          column: 0,
          headerIds: ["header"],
          text: "Cell.",
          inlines: run("Cell."),
        },
      ],
    },
  ];
  return {
    chapterId: "notes",
    blocks,
    href: "notes.xhtml",
    label: "Notes",
    title: "Notes",
    spineIndex: 1,
    nextChapterId: null,
    previousChapterId: "body",
  };
}
