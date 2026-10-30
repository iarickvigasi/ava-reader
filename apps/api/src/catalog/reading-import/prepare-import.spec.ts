import { prepareImport } from './prepare-import';
import { classicEpubFixture } from './classic-epub.fixture';
import { importFixture } from './import-fixture';
import { checksumBuffer } from '../../shared/blob-utils';

async function fixture(embedded = '') {
  const buffer = await classicEpubFixture(embedded);
  const checksum = checksumBuffer(buffer);
  const manifest = {
    ...importFixture,
    checksum,
    fileMetadata: {
      operatorLanguageVerification: {
        sha256: checksum,
        language: 'en',
        method: 'TEXT_SAMPLES',
        notes:
          'Operator checked English text at the beginning, middle, and end.',
        verifiedAt: new Date().toISOString(),
      },
    },
  };
  const file = { buffer, originalname: 'classic.epub' } as Express.Multer.File;
  return { manifest, file };
}

it('accepts a missing EPUB language with verification bound to the original bytes', async () => {
  const { manifest, file } = await fixture();
  await expect(prepareImport(manifest, file)).resolves.toBeDefined();
});

it('rejects missing language without operator verification', async () => {
  const { manifest, file } = await fixture();
  await expect(
    prepareImport({ ...manifest, fileMetadata: {} }, file),
  ).rejects.toThrow('language');
});

it('rejects verification for different bytes', async () => {
  const { manifest, file } = await fixture();
  manifest.fileMetadata.operatorLanguageVerification.sha256 = '0'.repeat(64);
  await expect(prepareImport(manifest, file)).rejects.toThrow('language');
});

it('rejects verification for another language', async () => {
  const { manifest, file } = await fixture();
  manifest.fileMetadata.operatorLanguageVerification.language = 'es';
  await expect(prepareImport(manifest, file)).rejects.toThrow('language');
});

it('preserves rejection of conflicting embedded language despite verification', async () => {
  const { manifest, file } = await fixture('ru');
  await expect(prepareImport(manifest, file)).rejects.toThrow('language');
});
