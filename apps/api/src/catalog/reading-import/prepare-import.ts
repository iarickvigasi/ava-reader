import { BadRequestException } from '@nestjs/common';
import { verifiedImportLanguage } from './verified-import-language';
import { checksumBuffer } from '../../shared/blob-utils';
import { extractBookMetadata } from '../../shared/metadata-extractor';
import { normalizeBookLanguage } from '../../shared/book-utils';
import { validateEpubArchive } from './validate-epub-archive';
import type { ImportManifest } from './manifest';

export async function prepareImport(
  manifest: ImportManifest,
  file: Express.Multer.File,
) {
  if (
    !file ||
    file.buffer.length < 4 ||
    checksumBuffer(file.buffer) !== manifest.checksum
  )
    throw new BadRequestException('Source does not match reviewed EPUB');
  await validateEpubArchive(file.buffer);
  const metadata = await extractBookMetadata({
    ...file,
    originalname: 'source.epub',
  });
  const language = normalizeBookLanguage(
    verifiedImportLanguage(metadata.language, manifest),
  );
  if (
    !language ||
    new Intl.Locale(language).language !==
      new Intl.Locale(manifest.language).language
  )
    throw new BadRequestException(
      'EPUB language does not match the catalog edition',
    );
  return metadata;
}
