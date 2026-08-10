import type {
  ReaderBlock,
  ReaderChapterPayload,
  ReaderStatusPayload,
} from "@/lib/api-types";

export function createReaderResumeFixturePayload(): ReaderStatusPayload {
  const chapterIds = ["chapter-1", "chapter-2", "chapter-3"];

  return {
    activeChapterId: "chapter-1",
    book: {
      authors: ["Fixture Author"],
      libraryItemId: "reader-resume-fixture",
      primaryFormat: "EPUB",
      slug: "reader-resume-fixture",
      title: "Reader Resume Fixture",
    },
    chapters: chapterIds.map((chapterId, index) =>
      createFixtureChapter({
        chapterId,
        nextChapterId: chapterIds[index + 1] ?? null,
        previousChapterId: chapterIds[index - 1] ?? null,
        spineIndex: index,
      }),
    ),
    progress: {
      chapterLabel: "Fixture Chapter 1",
      completionPercent: 0,
      lastReadAt: null,
      locator: null,
    },
    status: "READY",
    toc: [
      {
        anchorId: null,
        blockId: null,
        chapterId: "chapter-1",
        children: [
          {
            anchorId: "chapter-1-heading",
            blockId: "chapter-1::heading",
            chapterId: "chapter-1",
            children: [],
            href: "#chapter-1-heading",
            id: "toc:0.0",
            label: "Fixture Chapter 1 Opening",
            spineIndex: 0,
          },
        ],
        href: "#chapter-1",
        id: "toc:0",
        label: "Fixture Chapter 1",
        spineIndex: 0,
      },
      {
        anchorId: null,
        blockId: null,
        chapterId: "chapter-2",
        children: [],
        href: "#chapter-2",
        id: "toc:1",
        label: "Fixture Chapter 2",
        spineIndex: 1,
      },
      {
        anchorId: null,
        blockId: null,
        chapterId: "chapter-3",
        children: [],
        href: "#chapter-3",
        id: "toc:2",
        label: "Fixture Chapter 3",
        spineIndex: 2,
      },
    ],
  };
}

function createFixtureChapter(input: {
  chapterId: string;
  nextChapterId: string | null;
  previousChapterId: string | null;
  spineIndex: number;
}): ReaderChapterPayload {
  const chapterNumber = input.spineIndex + 1;
  const blocks: ReaderBlock[] = [
    {
      anchorId: `${input.chapterId}-heading`,
      id: `${input.chapterId}::heading`,
      inlines: [
        {
          kind: "text",
          text: `Fixture Chapter ${chapterNumber}`,
        },
      ],
      kind: "heading",
      level: 1,
      text: `Fixture Chapter ${chapterNumber}`,
    },
    {
      id: `${input.chapterId}::paragraph-long`,
      inlines: [
        {
          kind: "text",
          text: createLongFixtureParagraph(chapterNumber),
        },
      ],
      kind: "paragraph",
      text: createLongFixtureParagraph(chapterNumber),
    },
    {
      id: `${input.chapterId}::paragraph-tail`,
      inlines: [
        {
          kind: "text",
          text: `This shorter closing paragraph belongs to fixture chapter ${chapterNumber}.`,
        },
      ],
      kind: "paragraph",
      text: `This shorter closing paragraph belongs to fixture chapter ${chapterNumber}.`,
    },
    // A word too wide for a mobile column, and a bare-URL citation list: the
    // two shapes that used to paint across the column gap onto the next page
    // (see spec 1.1-content-rendering). Kept so /dev/reader-resume-fixture
    // stays a repro for it.
    {
      anchorId: `${input.chapterId}-overflow-heading`,
      id: `${input.chapterId}::heading-unbreakable`,
      inlines: [{ kind: "text", text: UNBREAKABLE_HEADING_TEXT }],
      kind: "heading",
      level: 2,
      text: UNBREAKABLE_HEADING_TEXT,
    },
    {
      id: `${input.chapterId}::paragraph-citations`,
      inlines: [{ kind: "text", text: CITATIONS_TEXT }],
      kind: "paragraph",
      text: CITATIONS_TEXT,
    },
  ];

  return {
    blocks,
    chapterId: input.chapterId,
    href: `#${input.chapterId}`,
    label: `Fixture Chapter ${chapterNumber}`,
    nextChapterId: input.nextChapterId,
    previousChapterId: input.previousChapterId,
    spineIndex: input.spineIndex,
    title: `Fixture Chapter ${chapterNumber}`,
  };
}

const UNBREAKABLE_HEADING_TEXT = "Kernschmelzenüberwachungsverordnung";

const CITATIONS_TEXT =
  "4 NASA, ‘Slime mold simulations used to map dark matter holding universe " +
  "together’; <https://www.nasa.gov/feature/goddard/2020/nasa-slime-mold-simulations-used-to-map-dark-matter-holding-universe-together/> " +
  "5 T. Nakagaki, ‘Maze-solving by an amoeboid organism’, Nature 407 (470), " +
  "2000; <https://www.nature.com/articles/35035159?error=cookies_not_supported&code=1234-5678>";

function createLongFixtureParagraph(chapterNumber: number) {
  return Array.from({ length: 220 }, (_, index) => {
    return `Chapter ${chapterNumber} sentence ${index + 1} keeps the reader resume fixture deterministic and long enough to span multiple pages in the paginated layout.`;
  }).join(" ");
}
