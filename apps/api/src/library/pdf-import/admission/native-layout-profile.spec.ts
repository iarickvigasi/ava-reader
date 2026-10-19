import { checksumBuffer } from '../../../shared/blob-utils';
import {
  PDF_IMPORT_PROFILE,
  PDF_IMPORT_PROFILE_V3,
  pdfImportConfiguration,
} from './profile';
import { validatePdfUpload } from './validate-upload';
const policy = 'ava-native-layout-1';
const configuration = pdfImportConfiguration as (
  profile?: string,
  layout?: unknown,
) => Record<string, unknown>;
const upload = () => {
  const buffer = Buffer.from('%PDF-1.7\nsynthetic');
  return {
    file: {
      buffer,
      size: buffer.length,
      originalname: 'Story.pdf',
    } as Express.Multer.File,
    idempotencyKey: 'request_1234567890',
    convertToEpub: true,
  };
};
it.each([PDF_IMPORT_PROFILE, PDF_IMPORT_PROFILE_V3])(
  'captures an explicit policy without changing historical configuration %j',
  (old) => {
    const selected = configuration(old.profileId, policy);
    expect(selected).toEqual({ ...old, sourceLayoutPolicy: policy });
    expect(configuration(old.profileId)).toBe(old);
    expect(configuration(old.profileId, '')).toBe(old);
    const input = {
      ...upload(),
      profileId: old.profileId,
      sourceLayoutPolicy: policy,
    };
    const current = validatePdfUpload(input);
    const prior = validatePdfUpload({
      ...input,
      sourceLayoutPolicy: undefined,
    });
    expect(current.configuration).toEqual(selected);
    expect(current.configSha256).toBe(
      checksumBuffer(Buffer.from(JSON.stringify(selected))),
    );
    expect(current.configSha256).not.toBe(prior.configSha256);
    expect(current.requestSha256).not.toBe(prior.requestSha256);
    expect(current.sourceSha256).toBe(prior.sourceSha256);
  },
);
it.each(['unknown', null, false, {}, 'ava-native-layout-2'])(
  'refuses unknown server policy %j',
  (value) => {
    expect(() => configuration(PDF_IMPORT_PROFILE_V3.profileId, value)).toThrow(
      'PDF_IMPORT_PROFILE_INVALID',
    );
  },
);
