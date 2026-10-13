import { reconstructionRequest } from './reconstruction-request';
import { validatePacket } from './validate-packet';
import {
  PDF_IMPORT_PROFILE,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
  capturedSourceStructurePolicy,
  pdfImportConfiguration,
} from '../../library/pdf-import/admission/profile';
import { checksumBuffer } from '../../shared/blob-utils';
const identity = {
  profileId: PDF_IMPORT_PROFILE.profileId,
  sourceSha256: 'a'.repeat(64),
  sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
};

it('retains captured Layout1 Input3 and enables Input4 only through the distinct structure capture', () => {
  const old = reconstructionRequest(identity);
  expect(old.schema_version).toBe('ava-reconstruct-input-3');
  expect(validatePacket('NativeLayoutReconstructionInput', old)).toEqual(old);
  const configuration = pdfImportConfiguration(
    identity.profileId,
    NATIVE_LAYOUT_POLICY,
    NATIVE_STRUCTURE_POLICY,
  );
  const policy = capturedSourceStructurePolicy(
    identity.profileId,
    checksumBuffer(Buffer.from(JSON.stringify(configuration))),
  );
  const current = reconstructionRequest({
    ...identity,
    sourceStructurePolicy: policy,
  });
  expect(current.schema_version).toBe('ava-reconstruct-input-4');
  expect(validatePacket('NativeStructureReconstructionInput', current)).toEqual(
    current,
  );
  expect(() =>
    validatePacket('NativeLayoutReconstructionInput', current),
  ).toThrow('INVALID_RESULT');
});
