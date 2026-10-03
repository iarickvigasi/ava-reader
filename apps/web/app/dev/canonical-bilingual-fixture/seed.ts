import type { ReaderStatusPayload } from "@/lib/api-types/reader";
import type {
  BilingualChapter,
  BilingualUnit,
} from "@/lib/api-types/bilingual";
import { canonicalChapters } from "@/features/reader/canonical/chapters";
import { flowBlockIndex } from "@/features/reader/bilingual/content/flow-block-index";
import { canonicalLeaf } from "@/features/reader/bilingual/content/canonical-leaf";
import { getTranslationBucket } from "@/features/offline/buckets/translations/bucket";
import { applyTranslationChapter } from "@/features/offline/buckets/translations/sync";
// Isolated authored fixture; this does not call a model or mint a qualification.
export async function seedBilingualFixture(
  payload: Extract<ReaderStatusPayload, { status: "READY" }>,
  targetLang: string,
) {
  const pkg = payload.readerPackage!;
  const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  for (const source of canonicalChapters(
    pkg.book,
    payload.resourceUrls ?? {},
  )) {
    const units: BilingualUnit[] = [];
    for (const [id, root] of flowBlockIndex(source.blocks)) {
      const leaf = canonicalLeaf(root, id);
      if (!leaf || leaf.kind === "list" || leaf.kind === "table") continue;
      const kind =
        leaf.kind === "image"
          ? "image"
          : leaf.kind === "code" || leaf.kind === "separator"
            ? "literal"
            : "sentence";
      const parts =
        kind === "sentence"
          ? (leaf.kind === "verse"
              ? [...leaf.text.matchAll(/[^\n]+(?:\n|$)/g)].map((m) => ({
                  segment: m[0],
                  index: m.index,
                }))
              : [...segmenter.segment(leaf.text)]
            ).filter((p) => p.segment.trim())
          : [{ segment: leaf.text, index: 0 }];
      for (const part of parts)
        units.push({
          id: `fixture-${id}-${part.index}`,
          kind,
          blockId: id,
          text: part.segment,
          startOffset: part.index,
          endOffset: part.index + part.segment.length,
        });
    }
    const translations = Object.fromEntries(
      units
        .filter((u) => u.kind === "sentence")
        .map((u) => [u.id, `Test · ${u.text}`]),
    );
    const chapter: BilingualChapter = {
      libraryItemId: payload.book.libraryItemId,
      chapterId: source.chapterId,
      contentRevision: pkg.final_content_id,
      translationVersion: 1,
      targetLang,
      units,
      translations,
      alignments: Object.fromEntries(
        units
          .filter((u) => u.kind === "sentence")
          .map((u) => [
            u.id,
            {
              version: 3,
              sourceText: u.text,
              translatedText: translations[u.id],
              groups: [],
            },
          ]),
      ),
    };
    const bucket = getTranslationBucket({
      ...chapter,
      expectedContentRevision: pkg.final_content_id,
    });
    await bucket.hydrated;
    applyTranslationChapter(bucket, chapter);
  }
}
