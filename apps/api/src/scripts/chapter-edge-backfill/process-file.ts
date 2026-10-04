import type { BookFile, PrismaClient } from '@prisma/client';
import { parseReaderPackage } from '../../reader/package/parse-reader-package';
import { normalizeHrefForLookup } from '../../reader/epub/archive';
import { checksumBuffer } from '../../shared/blob-utils';
import { savePackage } from '../chapter-label-backfill/save-package';
import { readSourceSections } from './read-source-sections';
import { planGroups } from './plan-groups';
import { regroupPackage } from './regroup-package';
import { regroupIndex } from './regroup-index';
import { checkReferences } from './check-references';
import { hasRemovedSourceTarget } from './has-removed-source-target';
import type { EdgePackage } from './types';

export async function processFile(
  prisma: PrismaClient,
  file: BookFile,
  apply: boolean,
) {
  const book = await prisma.book.findUniqueOrThrow({
    where: { id: file.bookId },
    select: { pdfImportPrivate: true, canonicalImportPrivate: true },
  });
  if (book.pdfImportPrivate || book.canonicalImportPrivate)
    return {
      status: 'blocked',
      blockers: ['Finished PDF/canonical books are excluded from regrouping'],
    };
  const stored = await prisma.storedBlob.findUniqueOrThrow({
    where: { id: file.blobId },
    select: { bytes: true },
  });
  const bytes = Buffer.from(stored.bytes);
  parseReaderPackage(bytes);
  // Keep raw blocks and unknown fields; normalization could change unrelated text.
  const original = JSON.parse(bytes.toString('utf8')) as EdgePackage;
  if (original.edgeGroupingVersion === 1) return { status: 'unchanged' };
  const sources = await prisma.bookFile.findMany({
    where: {
      bookId: file.bookId,
      kind: 'SOURCE',
      format: 'EPUB',
      isPrimary: true,
    },
    select: { blobId: true },
  });
  if (sources.length !== 1)
    throw new Error('Expected exactly one primary EPUB source');
  const source = await prisma.storedBlob.findUniqueOrThrow({
    where: { id: sources[0].blobId },
    select: { bytes: true },
  });
  const sourceBytes = Buffer.from(source.bytes);
  if (checksumBuffer(sourceBytes) !== original.manifest.sourceChecksum)
    throw new Error('Source checksum does not match stored package');
  const sections = await readSourceSections(sourceBytes, original);
  const groups = planGroups(original, sections);
  if (!groups.length) return { status: 'unchanged' };
  const pkg = regroupPackage(original, groups);
  const removed = new Set(groups.flatMap((g) => g.chapterIds.slice(1)));
  const blockers = await checkReferences(prisma, file.bookId, removed);
  if (hasRemovedSourceTarget(original, removed))
    blockers.push('Source internal links target removed chapters');
  let index: ReturnType<typeof regroupIndex> | undefined;
  try {
    index = regroupIndex(file.readingProgressIndex, pkg, groups);
  } catch (error) {
    blockers.push(String(error));
  }
  const saved =
    apply && !blockers.length
      ? await savePackage(prisma, file, pkg, index!)
      : null;
  return {
    status: blockers.length ? 'blocked' : apply ? 'applied' : 'dry-run',
    before: original.chapters.length,
    after: pkg.chapters.length,
    groups,
    blockers,
    evidence: original.chapters
      .filter((c) => groups.some((g) => g.chapterIds.includes(c.chapterId)))
      .map((c) => ({
        chapterId: c.chapterId,
        href: c.href,
        label: c.label,
        reason: sections.get(normalizeHrefForLookup(c.href))?.evidence,
      })),
    ...saved,
  };
}
