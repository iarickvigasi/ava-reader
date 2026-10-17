import type { ReaderPackageV3 } from "@/lib/api-types/canonical-reader.generated";
import type { ReaderStatusPayload } from "@/lib/api-types/reader";
import source from "./reader-package.json";
import { windowImage } from "./resource";
import { canonicalPayload } from "../payload";

export function canonicalFixture(
  input = source,
): Extract<ReaderStatusPayload, { status: "READY" }> {
  const readerPackage = structuredClone(input) as ReaderPackageV3;
  return canonicalPayload({
    status: "READY",
    activeChapterId: "chapter-one",
    chapters: [],
    toc: [],
    book: {
      authors: ["AVA Fixture Studio"],
      language: "en",
      libraryItemId: "canonical-reader-fixture",
      primaryFormat: "EPUB",
      slug: "canonical-reader-fixture",
      title: "The Independent Harbour",
    },
    progress: {
      locator: null,
      chapterLabel: null,
      completionPercent: 0,
      lastReadAt: null,
    },
    readerPackage,
    resourceUrls: { "image-one": windowImage },
  }) as Extract<ReaderStatusPayload, { status: "READY" }>;
}
