import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { checksumBuffer } from '../../../shared/blob-utils';
import { PDF_IMPORT_PROFILE, PDF_CONFIG_HASH } from './profile';

export function validatePdfUpload(input: {
  file: Express.Multer.File;
  idempotencyKey: unknown;
  convertToEpub: unknown;
}) {
  const { file, idempotencyKey, convertToEpub } = input;
  if (convertToEpub !== 'true' && convertToEpub !== true)
    throw new BadRequestException('Conversion must be explicitly selected.');
  if (
    typeof idempotencyKey !== 'string' ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)
  )
    throw new BadRequestException('A valid Idempotency-Key is required.');
  if (!file || !Buffer.isBuffer(file.buffer) || !file.buffer.length)
    throw new BadRequestException('A PDF file is required.');
  if (file.buffer.length > PDF_IMPORT_PROFILE.maxSourceBytes)
    throw new PayloadTooLargeException('The PDF exceeds the upload limit.');
  if (
    file.size !== file.buffer.length ||
    !/^%PDF-[12]\.\d/.test(file.buffer.subarray(0, 8).toString('ascii'))
  )
    throw new BadRequestException(
      'The uploaded bytes are not a supported PDF.',
    );
  if (
    !file.originalname ||
    file.originalname.length > 255 ||
    Array.from(file.originalname).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw new BadRequestException('The source filename is invalid.');
  const sourceSha256 = checksumBuffer(file.buffer);
  const requestSha256 = checksumBuffer(
    Buffer.from(
      JSON.stringify({
        sourceSha256,
        size: file.buffer.length,
        filename: file.originalname,
        conversion: true,
        configSha256: PDF_CONFIG_HASH,
      }),
    ),
  );
  return {
    idempotencyKey,
    sourceSha256,
    requestSha256,
    configSha256: PDF_CONFIG_HASH,
  };
}
