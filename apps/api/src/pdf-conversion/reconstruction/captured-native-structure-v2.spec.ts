import { checksumBuffer } from '../../shared/blob-utils';
import {
  pdfImportConfiguration,
  PDF_IMPORT_PROFILE,
  PDF_IMPORT_PROFILE_V3,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
  NATIVE_STRUCTURE_V2_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  RECOGNITION_GEOMETRY_REPAIR_POLICY,
  FRONTMATTER_TITLE_POLICY,
} from '../../library/pdf-import/admission/profile';
import { capturedSourcePolicies } from '../../library/pdf-import/admission/captured-source-policies';
import { reconstructionRequest } from './reconstruction-request';
import { validatePacket } from './validate-packet';
import { nativeResponse2 } from './native-structure-v2-fixture';
import { nativeResponse } from './native-structure-fixture';

const args = [
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_V2_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  RECOGNITION_GEOMETRY_REPAIR_POLICY,
  FRONTMATTER_TITLE_POLICY,
] as const;
it.each([
  [
    PDF_IMPORT_PROFILE.profileId,
    '0fffcc842cce501bbcee910ce653064a702fee9ce5d592e4b39d14c3a693a88e',
  ],
  [
    PDF_IMPORT_PROFILE_V3.profileId,
    'e424ec48dacf225082d3d8c6ebc4438114de1f7151eeb0c30ad311f7cb39307a',
  ],
])(
  'captures explicit Native2 only with the full current feature stack: %s',
  (profile, expected) => {
    const configuration = pdfImportConfiguration(profile, ...args);
    const hash = checksumBuffer(Buffer.from(JSON.stringify(configuration)));
    expect(hash).toBe(expected);
    const policies = capturedSourcePolicies(profile, hash);
    expect(policies.sourceStructurePolicy).toBe(NATIVE_STRUCTURE_V2_POLICY);
    const identity = {
      profileId: profile,
      sourceSha256: nativeResponse2.source_sha256,
      ...policies,
    };
    const input = reconstructionRequest(identity, [], [], false, [
      nativeResponse2,
    ]);
    expect(
      validatePacket('NativeStructure2ReconstructionInput', input),
    ).toEqual(input);
    expect(() =>
      validatePacket('FrontmatterTitleReconstructionInput', input),
    ).toThrow('INVALID_RESULT');
    expect(() =>
      validatePacket('NativeStructure2ReconstructionInput', {
        ...input,
        native_structure_responses: [nativeResponse],
      }),
    ).toThrow('INVALID_RESULT');
  },
);

it.each([0, 2, 3, 4])('refuses missing full feature dependency %i', (index) => {
  const changed: unknown[] = [...args];
  changed[index] = undefined;
  expect(() =>
    pdfImportConfiguration(PDF_IMPORT_PROFILE.profileId, ...changed),
  ).toThrow('PDF_IMPORT_PROFILE_INVALID');
});

it('keeps absent opt-in and the old full-feature capture on historical contracts', () => {
  expect(pdfImportConfiguration(PDF_IMPORT_PROFILE.profileId)).toEqual(
    PDF_IMPORT_PROFILE,
  );
  const old = pdfImportConfiguration(
    PDF_IMPORT_PROFILE_V3.profileId,
    NATIVE_LAYOUT_POLICY,
    NATIVE_STRUCTURE_POLICY,
    NATIVE_WORD_WRAP_POLICY,
    RECOGNITION_GEOMETRY_REPAIR_POLICY,
    FRONTMATTER_TITLE_POLICY,
  );
  expect(checksumBuffer(Buffer.from(JSON.stringify(old)))).toBe(
    '5fed6a113e4851d26b843716cf48bbddf954e64155c82fd0655e63607600b8d4',
  );
  const policies = capturedSourcePolicies(
    PDF_IMPORT_PROFILE_V3.profileId,
    checksumBuffer(Buffer.from(JSON.stringify(old))),
  );
  expect(policies.sourceStructurePolicy).toBe(NATIVE_STRUCTURE_POLICY);
  const input = reconstructionRequest({
    profileId: old.profileId,
    sourceSha256: nativeResponse.source_sha256,
    ...policies,
  });
  expect(input.schema_version).toBe('ava-reconstruct-input-7');
  expect(() =>
    validatePacket('NativeStructure2ReconstructionInput', input),
  ).toThrow('INVALID_RESULT');
});
