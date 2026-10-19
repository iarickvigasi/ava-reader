import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { checksumBuffer } from '../../../shared/blob-utils';
import { validatePdfUpload } from './validate-upload';
import { PDF_IMPORT_PROFILE } from './profile';

const upload = () => {
  const buffer = Buffer.from('%PDF-1.7\nsynthetic');
  return {
    file: {
      buffer,
      size: buffer.length,
      originalname: 'Story.pdf',
    } as Express.Multer.File,
    idempotencyKey: 'request_1234567890',
    convertToEpub: 'true',
  };
};
describe('initial PDF request boundary', () => {
  it('binds exact source bytes and filename to explicit initial conversion', () => {
    const input = upload();
    const identity = validatePdfUpload(input);
    expect(identity.sourceSha256).toBe(checksumBuffer(input.file.buffer));
    input.file.originalname = 'Changed.pdf';
    expect(validatePdfUpload(input).requestSha256).not.toBe(
      identity.requestSha256,
    );
  });
  it.each(['false', '', '1'])('rejects implicit conversion %s', (value) => {
    expect(() =>
      validatePdfUpload({ ...upload(), convertToEpub: value }),
    ).toThrow(BadRequestException);
  });
  it.each(['', 'short', 'x'.repeat(129), 'key with spaces12345'])(
    'rejects key %s',
    (value) => {
      expect(() =>
        validatePdfUpload({ ...upload(), idempotencyKey: value }),
      ).toThrow(BadRequestException);
    },
  );
  it('rejects forged sizes, signatures and response-header control characters', () => {
    for (const changes of [
      { size: 1 },
      { buffer: Buffer.from('not a PDF') },
      { originalname: 'bad\r\nheader.pdf' },
    ]) {
      const input = upload();
      Object.assign(input.file, changes);
      expect(() => validatePdfUpload(input)).toThrow(BadRequestException);
    }
  });
  it('rejects bytes above the declared upload bound', () => {
    const input = upload();
    input.file.buffer = Buffer.alloc(PDF_IMPORT_PROFILE.maxSourceBytes + 1);
    expect(() => validatePdfUpload(input)).toThrow(PayloadTooLargeException);
  });
});

it('captures a separate server-selected profile without changing legacy configuration identity', () => {
  const legacy = validatePdfUpload(upload());
  const extended = validatePdfUpload({
    ...upload(),
    profileId: 'ava-pdf-prose-en-uk-v3',
  });
  expect(legacy.configuration).toBe(PDF_IMPORT_PROFILE);
  expect(extended.configuration.profileId).toBe('ava-pdf-prose-en-uk-v3');
  expect(extended.configSha256).not.toBe(legacy.configSha256);
  expect(extended.requestSha256).not.toBe(legacy.requestSha256);
  expect(validatePdfUpload(upload())).toEqual(legacy);
  expect(() =>
    validatePdfUpload({ ...upload(), profileId: 'invented' }),
  ).toThrow('PDF_IMPORT_PROFILE_INVALID');
});

it('binds explicit copy intent to request identity while retaining the original request hash', () => {
  const original = validatePdfUpload(upload());
  const copy = validatePdfUpload({
    ...upload(),
    copyOfOperationId: 'pdf-original',
  });
  expect(copy.sourceSha256).toBe(original.sourceSha256);
  expect(copy.configSha256).toBe(original.configSha256);
  expect(copy.requestSha256).not.toBe(original.requestSha256);
  expect(
    validatePdfUpload({ ...upload(), copyOfOperationId: undefined }),
  ).toEqual(original);
  expect(
    validatePdfUpload({ ...upload(), copyOfOperationId: 'pdf-other' })
      .requestSha256,
  ).not.toBe(copy.requestSha256);
});
it.each([null, true, [], {}, '', 'x'.repeat(201), 'book/path'])(
  'rejects malformed copy reference %j',
  (copyOfOperationId) => {
    expect(() => validatePdfUpload({ ...upload(), copyOfOperationId })).toThrow(
      BadRequestException,
    );
  },
);
