import type {
  BilingualChapter,
  BilingualUnit,
} from "@/lib/api-types/bilingual";
import { canonicalFixture } from "../../canonical/fixtures/payload";
import { canonicalLeaf } from "./canonical-leaf";
import { flowBlockIndex } from "./flow-block-index";
export function canonicalBilingualFixture() {
  const payload = canonicalFixture();
  const source = payload.chapters[0];
  const roots = flowBlockIndex(source.blocks);
  const units: BilingualUnit[] = [];
  for (const [id, root] of roots) {
    const leaf = canonicalLeaf(root, id);
    if (!leaf || leaf.kind === "table" || leaf.kind === "list") continue;
    const kind =
      leaf.kind === "image"
        ? "image"
        : leaf.kind === "separator" || leaf.kind === "code"
          ? "literal"
          : "sentence";
    units.push({
      id: `unit-${id}`,
      blockId: id,
      kind,
      text: leaf.text,
      startOffset: 0,
      endOffset: leaf.text.length,
    });
  }
  const chapter: BilingualChapter = {
    libraryItemId: payload.book.libraryItemId,
    chapterId: source.chapterId,
    contentRevision: payload.readerPackage!.final_content_id,
    translationVersion: 1,
    targetLang: "French",
    units,
    translations: Object.fromEntries(
      units
        .filter((u) => u.kind === "sentence")
        .map((u) => [u.id, `FR ${u.text}`]),
    ),
  };
  return { payload, source, chapter };
}
