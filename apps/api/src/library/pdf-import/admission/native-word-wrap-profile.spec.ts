import { checksumBuffer } from '../../../shared/blob-utils';
import {
  pdfImportConfiguration,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  capturedSourceLayoutPolicy,
  capturedSourceStructurePolicy,
  capturedSourceNormalizationPolicy,
} from './profile';

it.each([
  [
    'ava-pdf-prose-en-v2',
    '7d59c08092c43b3a2cb7d3203ff2f6bf7ff5c580e82bf570251baaace05d746a',
  ],
  [
    'ava-pdf-prose-en-uk-v3',
    '0c4c76cb8558a0574cf72d9adc2c11a60a3f661947be76e4d483dd5162252e2c',
  ],
])(
  'pins a distinct captured normalization configuration for %s',
  (profile, hash) => {
    const config = pdfImportConfiguration(
      profile,
      NATIVE_LAYOUT_POLICY,
      NATIVE_STRUCTURE_POLICY,
      NATIVE_WORD_WRAP_POLICY,
    );
    expect(checksumBuffer(Buffer.from(JSON.stringify(config)))).toBe(hash);
    expect(capturedSourceLayoutPolicy(profile, hash)).toBe(
      NATIVE_LAYOUT_POLICY,
    );
    expect(capturedSourceStructurePolicy(profile, hash)).toBe(
      NATIVE_STRUCTURE_POLICY,
    );
    expect(capturedSourceNormalizationPolicy(profile, hash)).toBe(
      NATIVE_WORD_WRAP_POLICY,
    );
    const old = pdfImportConfiguration(
      profile,
      NATIVE_LAYOUT_POLICY,
      NATIVE_STRUCTURE_POLICY,
    );
    const oldHash = checksumBuffer(Buffer.from(JSON.stringify(old)));
    expect(capturedSourceNormalizationPolicy(profile, oldHash)).toBeUndefined();
    expect(
      pdfImportConfiguration(
        profile,
        NATIVE_LAYOUT_POLICY,
        NATIVE_STRUCTURE_POLICY,
        '',
      ),
    ).toEqual(old);
  },
);
it.each([
  [undefined, undefined, NATIVE_WORD_WRAP_POLICY],
  [NATIVE_LAYOUT_POLICY, undefined, NATIVE_WORD_WRAP_POLICY],
  [NATIVE_LAYOUT_POLICY, NATIVE_STRUCTURE_POLICY, 'unknown'],
])(
  'refuses normalization without its exact prior policies',
  (layout, structure, normalization) => {
    expect(() =>
      pdfImportConfiguration(undefined, layout, structure, normalization),
    ).toThrow('PDF_IMPORT_PROFILE_INVALID');
  },
);
