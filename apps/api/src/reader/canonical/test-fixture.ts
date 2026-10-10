import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CanonicalBookV2 } from '../../pdf-conversion/contracts/generated/ava-reader-3';
import type { OwnedLibraryItem } from '../library-item-access';
import type { PdfAcceptedReader } from './load';
export function fixture() {
  const book = JSON.parse(
    readFileSync(
      resolve(
        __dirname,
        '../../../../../packages/pdf-epub/tests/epub_v2/fixtures/canonical.json',
      ),
      'utf8',
    ),
  ) as CanonicalBookV2;
  const item = {
    id: 'library',
    userId: 'owner',
    slug: 'book',
    book: {
      title: 'Edited title',
      authors: [],
      language: 'en',
      files: [{ isPrimary: true, kind: 'SOURCE', format: 'PDF' }],
    },
    progress: null,
  } as unknown as OwnedLibraryItem;
  const accepted = {
    readerPackage: {
      schema_version: 'ava-reader-3',
      version: 3,
      final_content_id: 'final',
      canonical_hash_algorithm: 'ava-json-v1',
      canonical_sha256: 'a'.repeat(64),
      required_capabilities: [],
      book,
    },
    resourceUrls: {
      'image-one': '/api/library/pdf-imports/operation/resources/image-one',
    },
    publication: { id: 'publication' },
    operation: { id: 'operation' },
  } as unknown as PdfAcceptedReader;
  return { book, item, accepted };
}
