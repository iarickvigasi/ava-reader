import type { ImportedEpubReader } from '../../library/epub-import/load-imported-reader';
import { fixture } from './test-fixture';
export function importedFixture() {
  const value = fixture();
  const accepted = {
    kind: 'epub-import',
    readerPackage: {
      ...value.accepted.readerPackage,
      final_content_id: 'imported-final',
    },
    resourceUrls: {
      'image-one': '/api/library/epub-imports/import/resources/image-one',
    },
    importRecord: {
      id: 'import',
      libraryItemId: 'library',
      ownerId: 'owner',
      bookId: 'book',
      sourceSha256: '1'.repeat(64),
      readerSha256: '2'.repeat(64),
      finalContentId: 'imported-final',
    },
  } as unknown as ImportedEpubReader;
  return { ...value, accepted };
}
