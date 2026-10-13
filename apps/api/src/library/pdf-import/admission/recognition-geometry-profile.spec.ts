import { checksumBuffer } from '../../../shared/blob-utils';
import {
  pdfImportConfiguration,
  RECOGNITION_GEOMETRY_REPAIR_POLICY,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  capturedRecognitionRepairPolicy,
} from './profile';
import { capturedSourcePolicies } from './captured-source-policies';
import { validatePdfUpload } from './validate-upload';

it.each([
  [
    'ava-pdf-prose-en-v2',
    '75709f32827723b3675d81bc84177b6d7dfffbb3f9abb8ada5f48e504f84db4a',
  ],
  [
    'ava-pdf-prose-en-uk-v3',
    'a12919c9d07e696b224aafc0e4f5d648d0e66406306b443f58628609595073e4',
  ],
])(
  'pins an additive repair identity for %s while old captures remain unchanged',
  (profile, hash) => {
    const config = pdfImportConfiguration(
      profile,
      NATIVE_LAYOUT_POLICY,
      NATIVE_STRUCTURE_POLICY,
      NATIVE_WORD_WRAP_POLICY,
      RECOGNITION_GEOMETRY_REPAIR_POLICY,
    );
    expect(checksumBuffer(Buffer.from(JSON.stringify(config)))).toBe(hash);
    expect(capturedRecognitionRepairPolicy(profile, hash)).toBe(
      RECOGNITION_GEOMETRY_REPAIR_POLICY,
    );
    expect(capturedSourcePolicies(profile, hash)).toEqual({
      sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
      sourceStructurePolicy: NATIVE_STRUCTURE_POLICY,
      sourceNormalizationPolicy: NATIVE_WORD_WRAP_POLICY,
      recognitionRepairPolicy: RECOGNITION_GEOMETRY_REPAIR_POLICY,
    });
    const old = pdfImportConfiguration(
      profile,
      NATIVE_LAYOUT_POLICY,
      NATIVE_STRUCTURE_POLICY,
      NATIVE_WORD_WRAP_POLICY,
    );
    const oldHash = checksumBuffer(Buffer.from(JSON.stringify(old)));
    expect(capturedRecognitionRepairPolicy(profile, oldHash)).toBeUndefined();
    expect(
      pdfImportConfiguration(
        profile,
        NATIVE_LAYOUT_POLICY,
        NATIVE_STRUCTURE_POLICY,
        NATIVE_WORD_WRAP_POLICY,
        '',
      ),
    ).toEqual(old);
  },
);
it.each([
  [undefined, undefined, undefined, RECOGNITION_GEOMETRY_REPAIR_POLICY],
  [
    NATIVE_LAYOUT_POLICY,
    NATIVE_STRUCTURE_POLICY,
    undefined,
    RECOGNITION_GEOMETRY_REPAIR_POLICY,
  ],
  [
    NATIVE_LAYOUT_POLICY,
    NATIVE_STRUCTURE_POLICY,
    NATIVE_WORD_WRAP_POLICY,
    'foreign',
  ],
])(
  'requires all exact preceding policies',
  (layout, structure, normalization, repair) => {
    expect(() =>
      pdfImportConfiguration(
        undefined,
        layout,
        structure,
        normalization,
        repair,
      ),
    ).toThrow('PDF_IMPORT_PROFILE_INVALID');
  },
);
it('changes new upload identity without changing original source bytes or old jobs', () => {
  const buffer = Buffer.from('%PDF-1.7 synthetic');
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
    sourceNormalizationPolicy: NATIVE_WORD_WRAP_POLICY,
  };
  const old = validatePdfUpload(input);
  const current = validatePdfUpload({
    ...input,
    recognitionRepairPolicy: RECOGNITION_GEOMETRY_REPAIR_POLICY,
  });
  expect(current.sourceSha256).toBe(old.sourceSha256);
  expect(current.configSha256).not.toBe(old.configSha256);
  expect(current.requestSha256).not.toBe(old.requestSha256);
});
