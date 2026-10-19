import {
  capturedSourceLayoutPolicy,
  NATIVE_LAYOUT_POLICY,
  PDF_IMPORT_PROFILE,
  PDF_IMPORT_PROFILE_V3,
  pdfImportConfiguration,
} from '../../library/pdf-import/admission/profile';
import { checksumBuffer } from '../../shared/blob-utils';
import { reconstructionRequest } from './reconstruction-request';
import { validatePacket } from './validate-packet';
import { printedTitleResponse } from './printed-title-fixture';
const hash = (x: unknown) => checksumBuffer(Buffer.from(JSON.stringify(x)));
it('retains both historical configuration hashes exactly', () => {
  expect(hash(PDF_IMPORT_PROFILE)).toBe(
    'de58a3f974a9eb48b4540efd96db6c4366b04db0cffee3eb1723482ac9b8e33f',
  );
  expect(hash(PDF_IMPORT_PROFILE_V3)).toBe(
    '40132ffcc633f0f8ec0024a01d4a33895b65f7de4da132f977316c6a9e161898',
  );
});
it.each([PDF_IMPORT_PROFILE, PDF_IMPORT_PROFILE_V3])(
  'derives policy only from captured %j configuration',
  (profile) => {
    const current = pdfImportConfiguration(
      profile.profileId,
      NATIVE_LAYOUT_POLICY,
    );
    expect(capturedSourceLayoutPolicy(profile.profileId, hash(current))).toBe(
      NATIVE_LAYOUT_POLICY,
    );
    for (const old of [
      hash(profile),
      'a'.repeat(64),
      undefined,
      null,
      NATIVE_LAYOUT_POLICY,
    ])
      expect(
        capturedSourceLayoutPolicy(profile.profileId, old),
      ).toBeUndefined();
    const other =
      profile.profileId === PDF_IMPORT_PROFILE.profileId
        ? PDF_IMPORT_PROFILE_V3
        : PDF_IMPORT_PROFILE;
    expect(
      capturedSourceLayoutPolicy(other.profileId, hash(current)),
    ).toBeUndefined();
  },
);
it('does not upgrade historical captured authority from a current selector', () => {
  const prior = process.env.AVA_PDF_SOURCE_LAYOUT_POLICY;
  process.env.AVA_PDF_SOURCE_LAYOUT_POLICY = NATIVE_LAYOUT_POLICY;
  try {
    expect(
      capturedSourceLayoutPolicy(
        PDF_IMPORT_PROFILE.profileId,
        hash(PDF_IMPORT_PROFILE),
      ),
    ).toBeUndefined();
  } finally {
    if (prior === undefined) delete process.env.AVA_PDF_SOURCE_LAYOUT_POLICY;
    else process.env.AVA_PDF_SOURCE_LAYOUT_POLICY = prior;
  }
});
it('keeps exact old empty initial request bytes and the B2 selection', () => {
  const identity = {
    profileId: PDF_IMPORT_PROFILE.profileId,
    sourceSha256: 'a'.repeat(64),
  };
  expect(JSON.stringify(reconstructionRequest(identity))).toBe(
    JSON.stringify({
      schema_version: 'ava-reconstruct-input-1',
      source_feature_policy: 'ava-ocr-source-features-1',
      profile_id: identity.profileId,
      source_sha256: identity.sourceSha256,
      responses: [],
      refinements: [],
    }),
  );
  expect(reconstructionRequest(identity, [], [], true).schema_version).toBe(
    'ava-reconstruct-input-2',
  );
});
it('retains Input3 in zero-task and title-scheduled paths without widening Input2', () => {
  const identity = {
    profileId: PDF_IMPORT_PROFILE.profileId,
    sourceSha256: 'a'.repeat(64),
    sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
  };
  const initial = reconstructionRequest(identity);
  expect(validatePacket('NativeLayoutReconstructionInput', initial)).toEqual(
    initial,
  );
  const title = reconstructionRequest(
    identity,
    [],
    [printedTitleResponse],
    true,
  );
  expect(title.schema_version).toBe('ava-reconstruct-input-3');
  expect(validatePacket('NativeLayoutReconstructionInput', title)).toEqual(
    title,
  );
  expect(() =>
    validatePacket('NativeLayoutReconstructionInput', {
      ...title,
      refinements: [printedTitleResponse, printedTitleResponse],
    }),
  ).toThrow('INVALID_RESULT');
  expect(() =>
    validatePacket('PrintedTitleReconstructionInput', {
      ...initial,
      schema_version: 'ava-reconstruct-input-2',
    }),
  ).toThrow('INVALID_RESULT');
});
