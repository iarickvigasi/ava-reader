import type { BilingualChapter } from "@/lib/api-types/bilingual";
import { ordinaryReferenceChapter } from "@/features/reader/ordinary-reference-fixture";

export function ordinaryNestedBilingualFixture() {
  const source = ordinaryReferenceChapter();
  const list = source.blocks[0];
  if (list.kind !== "list") throw new Error("Missing authored list");
  const child = list.items[0].children![0];
  child.ordered = true;
  child.start = 2;
  child.markerStyle = "lower-alpha";
  child.fontWeight = 700;
  Object.assign(child.items[0], {
    fontWeight: 400,
    fontSizeScale: 0.5,
    textIndent: 0,
    align: "center",
    presentation: { id: "reset", italic: false },
  });
  child.items[0].inlines = [
    {
      kind: "text",
      text: "Nested 😀.",
      fontWeight: 600,
      presentation: { id: "source", bold: true },
    },
  ];
  const units = [list.items[0], child.items[0], list.items[1]].map((item) => ({
    id: `unit-${item.id}`,
    blockId: item.id,
    startOffset: 0,
    endOffset: item.text.length,
    text: item.text,
    kind: "sentence" as const,
  }));
  const chapter: BilingualChapter = {
    libraryItemId: "authored-book",
    chapterId: source.chapterId,
    contentRevision: "authored-revision",
    translationVersion: 1,
    targetLang: "fr",
    units,
    translations: Object.fromEntries(
      units.map((unit) => [unit.id, `FR ${unit.text}`]),
    ),
  };
  return { source, chapter, list, child };
}
