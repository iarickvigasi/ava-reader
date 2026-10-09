import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { ReaderPackage } from '../reader-types';

// The TOC is authored navigation, not necessarily the complete reading order.
export function readerOfflineManifest(
  readerPackage: ReaderPackage,
  file: { id: string; blobId: string },
) {
  const chapterIds = readerPackage.chapters.map((chapter) => chapter.chapterId);
  if (!chapterIds.length || new Set(chapterIds).size !== chapterIds.length)
    throw new BadRequestException('The reader chapter order is invalid.');
  return {
    chapterIds,
    contentRevision: createHash('sha256')
      .update(
        JSON.stringify([
          file.id,
          file.blobId,
          readerPackage.manifest.sourceChecksum,
        ]),
      )
      .digest('hex'),
  };
}
