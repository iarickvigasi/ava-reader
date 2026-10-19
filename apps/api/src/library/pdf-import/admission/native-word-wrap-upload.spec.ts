import { validatePdfUpload } from './validate-upload';
import {
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  capturedSourceNormalizationPolicy,
} from './profile';

it('captures sparse normalization in new request identity while source bytes stay exact', () => {
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
    sourceStructurePolicy: NATIVE_STRUCTURE_POLICY,
  };
  const old = validatePdfUpload(input);
  const current = validatePdfUpload({
    ...input,
    sourceNormalizationPolicy: NATIVE_WORD_WRAP_POLICY,
  });
  expect(current.configSha256).not.toBe(old.configSha256);
  expect(current.requestSha256).not.toBe(old.requestSha256);
  expect(current.sourceSha256).toBe(old.sourceSha256);
  expect(
    capturedSourceNormalizationPolicy(
      current.configuration.profileId,
      old.configSha256,
    ),
  ).toBeUndefined();
  expect(
    capturedSourceNormalizationPolicy(
      current.configuration.profileId,
      current.configSha256,
    ),
  ).toBe(NATIVE_WORD_WRAP_POLICY);
});
