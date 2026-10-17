import type {
  ReaderChapterPayload,
  ReaderStatusPayload,
} from "@/lib/api-types";

export const previousChapter: ReaderChapterPayload = {
  chapterId: "ch7",
  href: "chapter-2.xhtml#ch4",
  title: "Notes",
  label: "Notes",
  spineIndex: 6,
  previousChapterId: "ch6",
  nextChapterId: "ch8",
  blocks: [
    {
      id: "ch4",
      kind: "heading",
      text: "Notes",
      level: 1,
      inlines: [{ kind: "text", text: "Notes" }],
    },
  ],
};
export const activeChapter: ReaderChapterPayload = {
  ...previousChapter,
  chapterId: "ch8",
  href: "chapter-2.xhtml#note-1",
  spineIndex: 7,
  previousChapterId: "ch7",
  nextChapterId: null,
  blocks: [
    {
      id: "note-1",
      kind: "note",
      noteRole: "endnote",
      text: "A source endnote.",
      inlines: [{ kind: "text", text: "A source endnote." }],
      returns: [
        {
          label: "Call1",
          target: { chapterId: "body", blockId: "call1", textOffset: 3 },
        },
        {
          label: "Call2",
          target: { chapterId: "body", blockId: "call2", textOffset: 4 },
        },
      ],
    },
    {
      id: "p-note-after",
      kind: "paragraph",
      text: "After the note.",
      inlines: [{ kind: "text", text: "After the note." }],
    },
  ],
};
export const coldPayload: Extract<ReaderStatusPayload, { status: "READY" }> = {
  status: "READY",
  activeChapterId: "ch8",
  chapters: [previousChapter, activeChapter],
  toc: [],
  book: {
    authors: ["AVA Fixture Studio"],
    language: "en",
    libraryItemId: "fixture",
    primaryFormat: "EPUB",
    slug: "fixture",
    title: "Cold resume fixture",
  },
  progress: {
    chapterLabel: "Notes",
    completionPercent: 91,
    lastReadAt: null,
    locator: { chapterId: "ch8", blockId: "note-1", textOffset: 0 },
  },
};
