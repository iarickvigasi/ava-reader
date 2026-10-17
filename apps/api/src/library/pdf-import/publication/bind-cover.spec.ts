import type { Tx } from '../jobs/types';
import type {
  AcceptedContentV1,
  Artifact,
} from '../../../pdf-conversion/contracts/generated/ava-accepted-content-1';
import { checksumBuffer } from '../../../shared/blob-utils';
import { bindPublishedCover } from './bind-cover';

function fixture(cover: string | null = 'cover') {
  const reportBytes = Buffer.from(
    JSON.stringify({
      schema_version: 'ava-publication-report-1',
      cover_resource_id: cover,
    }),
  );
  const imageBytes = Buffer.from('already-validated-png');
  const descriptor = (
    id: string,
    role: Artifact['role'],
    media_type: Artifact['media_type'],
    bytes: Buffer,
  ): Artifact => ({
    id,
    role,
    media_type,
    format: role === 'RESOURCE' ? 'IMAGE' : 'REPORT_JSON',
    path: id,
    sha256: checksumBuffer(bytes),
    byte_length: bytes.length,
  });
  const report = descriptor(
    'report',
    'VALIDATION_REPORT',
    'application/json',
    reportBytes,
  );
  const image = descriptor('image', 'RESOURCE', 'image/png', imageBytes);
  const accepted = {
    operation_id: 'operation',
    owner_id: 'owner',
    validation_report: report,
    resources: [image],
  } as AcceptedContentV1;
  const stored = (d: Artifact, bytes: Buffer) => ({
    blobId: d.id + '-blob',
    blob: {
      bytes,
      checksum: d.sha256,
      sizeBytes: bytes.length,
      mimeType: d.media_type,
    },
  });
  const findFirst = jest
    .fn()
    .mockResolvedValueOnce(stored(report, reportBytes))
    .mockResolvedValueOnce(stored(image, imageBytes));
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const tx = {
    pdfArtifact: { findFirst },
    book: { updateMany },
  } as unknown as Tx;
  return { tx, accepted, findFirst, updateMany };
}

it('binds only the validator-declared owned resource during first private PDF publication', async () => {
  const f = fixture();
  await bindPublishedCover(f.tx, 'book', f.accepted, { cover: 'image' });
  const cover = f.accepted.resources[0];
  expect(f.findFirst).toHaveBeenNthCalledWith(2, {
    where: {
      id: 'image',
      operationId: 'operation',
      ownerId: 'owner',
      role: 'RESOURCE',
      retention: 'ACCEPTED',
      checksum: cover.sha256,
      sizeBytes: cover.byte_length,
      mimeType: cover.media_type,
    },
    include: { blob: true },
  });
  expect(f.updateMany).toHaveBeenCalledWith({
    where: { id: 'book', pdfImportPrivate: true, coverBlobId: null },
    data: { coverBlobId: 'image-blob' },
  });
});
it('keeps absent covers absent without loading an image', async () => {
  const f = fixture(null);
  await bindPublishedCover(f.tx, 'book', f.accepted, {});
  expect(f.findFirst).toHaveBeenCalledTimes(1);
  expect(f.updateMany).not.toHaveBeenCalled();
});
it('refuses missing or unaccepted cover resources', async () => {
  for (const map of [{}, { cover: 'other' }]) {
    const f = fixture();
    await expect(
      bindPublishedCover(f.tx, 'book', f.accepted, map),
    ).rejects.toThrow('PDF_PUBLICATION_ARTIFACT_INVALID');
    expect(f.updateMany).not.toHaveBeenCalled();
  }
});
it('refuses changed report bytes and unavailable owned artifacts', async () => {
  for (const artifact of [
    null,
    {
      blob: {
        bytes: Buffer.from('{}'),
        checksum: 'changed',
        sizeBytes: 2,
        mimeType: 'application/json',
      },
    },
  ]) {
    const f = fixture();
    f.findFirst.mockReset().mockResolvedValue(artifact);
    await expect(
      bindPublishedCover(f.tx, 'book', f.accepted, { cover: 'image' }),
    ).rejects.toThrow('PDF_PUBLICATION_ARTIFACT_INVALID');
    expect(f.updateMany).not.toHaveBeenCalled();
  }
});
it('refuses existing/public book cover replacement', async () => {
  const f = fixture();
  f.updateMany.mockResolvedValue({ count: 0 });
  await expect(
    bindPublishedCover(f.tx, 'book', f.accepted, { cover: 'image' }),
  ).rejects.toThrow('PDF_PUBLICATION_ARTIFACT_INVALID');
});
