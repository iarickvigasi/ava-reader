import { validatePdfUpload } from './validate-upload';
import {
  capturedSourceStructurePolicy,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
} from './profile';

it('binds new upload/request identity to the separate capture without changing source bytes', () => {
  const buffer = Buffer.from('%PDF-1.7\nsynthetic');
  const input = {
    file: {
      buffer,
      size: buffer.length,
      originalname: 'Story.pdf',
    } as Express.Multer.File,
    idempotencyKey: 'request_1234567890',
    convertToEpub: true,
    sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
  };
  const old = validatePdfUpload(input);
  const current = validatePdfUpload({
    ...input,
    sourceStructurePolicy: NATIVE_STRUCTURE_POLICY,
  });
  expect(current.configSha256).not.toBe(old.configSha256);
  expect(current.requestSha256).not.toBe(old.requestSha256);
  expect(current.sourceSha256).toBe(old.sourceSha256);
  expect(
    capturedSourceStructurePolicy(
      current.configuration.profileId,
      old.configSha256,
    ),
  ).toBeUndefined();
});
