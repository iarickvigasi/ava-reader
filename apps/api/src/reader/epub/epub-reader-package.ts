import type { ReaderPackage } from '../reader-types';
import { readEpubPackageInput } from './read-epub-package-input';
import { readEpubChapters } from './read-epub-chapters';
import { buildEpubNavigation } from './build-epub-navigation';
import { resolveEpubLinks } from './links/resolve-epub-links';
import { remapEpubLinks } from './links/remap-epub-links';
import { normalizeEpubChapters } from './normalize-epub-chapters';

export async function buildReaderPackageFromEpub(input: {
  authors: string[];
  buffer: Buffer;
  checksum: string;
  language: string | null;
  title: string;
}): Promise<ReaderPackage> {
  const source = await readEpubPackageInput(input.buffer);
  const rawChapters = await readEpubChapters({
    ...source,
    language: input.language,
  });
  const { chapters, toc, authoredToc } = buildEpubNavigation({
    ...input,
    rawChapters,
    parsedToc: source.parsedToc,
  });
  const normalized = await normalizeEpubChapters(
    input.buffer,
    {
      chapters: resolveEpubLinks(chapters),
      manifest: {
        authors: input.authors,
        language: input.language,
        sourceChecksum: input.checksum,
        title: input.title,
        totalBlocks: chapters.reduce(
          (sum, chapter) => sum + chapter.blocks.length,
          0,
        ),
        totalChapters: chapters.length,
      },
      toc,
      version: 2,
    },
    authoredToc,
  );
  return { ...normalized, chapters: remapEpubLinks(normalized.chapters) };
}
