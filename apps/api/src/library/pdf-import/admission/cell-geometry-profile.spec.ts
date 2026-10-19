import { checksumBuffer } from '../../../shared/blob-utils';
import {
  pdfImportConfiguration,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_V2_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
  FRONTMATTER_TITLE_POLICY,
} from './profile';
import { capturedSourcePolicies } from './captured-source-policies';
import { capturedCellGeometryPolicy } from './captured-cell-geometry-policy';

it.each([
  [
    'ava-pdf-prose-en-v2',
    '715bc6a2a09a67cb428b6c9b831295b5b3a0bb478411ef073adb825db5b52b53',
  ],
  [
    'ava-pdf-prose-en-uk-v3',
    '65b7b299d373ff163147e38c4e8718a69fafe623f11c4478172f51517045b92d',
  ],
])(
  'matches the installed cell supervisor capture for %s',
  (profile, expected) => {
    const configuration = pdfImportConfiguration(
      profile,
      NATIVE_LAYOUT_POLICY,
      NATIVE_STRUCTURE_V2_POLICY,
      NATIVE_WORD_WRAP_POLICY,
      RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
      FRONTMATTER_TITLE_POLICY,
    );
    const hash = checksumBuffer(Buffer.from(JSON.stringify(configuration)));
    expect(hash).toBe(expected);
    expect(capturedSourcePolicies(profile, hash)).toEqual({
      sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
      sourceStructurePolicy: NATIVE_STRUCTURE_V2_POLICY,
      sourceNormalizationPolicy: NATIVE_WORD_WRAP_POLICY,
      recognitionRepairPolicy: RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
      sourceTitlePolicy: FRONTMATTER_TITLE_POLICY,
    });
    const old = pdfImportConfiguration(
      profile,
      NATIVE_LAYOUT_POLICY,
      NATIVE_STRUCTURE_V2_POLICY,
      NATIVE_WORD_WRAP_POLICY,
      'ava-recognition-geometry-repair-1',
      FRONTMATTER_TITLE_POLICY,
    );
    const oldHash = checksumBuffer(Buffer.from(JSON.stringify(old)));
    expect(capturedCellGeometryPolicy(profile, oldHash)).toBeUndefined();
    expect(
      capturedSourcePolicies(profile, oldHash).recognitionRepairPolicy,
    ).toBe('ava-recognition-geometry-repair-1');
  },
);
it.each([undefined, 'ava-native-structure-1', 'unknown'])(
  'refuses cell recovery without current structure stack %s',
  (structure) => {
    expect(() =>
      pdfImportConfiguration(
        'ava-pdf-prose-en-v2',
        NATIVE_LAYOUT_POLICY,
        structure,
        NATIVE_WORD_WRAP_POLICY,
        RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
        FRONTMATTER_TITLE_POLICY,
      ),
    ).toThrow('PDF_IMPORT_PROFILE_INVALID');
  },
);
