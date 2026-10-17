import { reconstructionRequest } from './reconstruction-request';
import { validatePacket } from './validate-packet';
import { nativeTask, nativeResponse } from './native-structure-fixture';
import { response } from './test-fixture';
const identity = {
  sourceSha256: nativeTask.source_sha256,
  profileId: nativeTask.profile_id,
  sourceLayoutPolicy: 'ava-native-layout-1' as const,
  sourceStructurePolicy: 'ava-native-structure-1' as const,
};

it('shares the 25000 receipt limit between OCR and native decisions', () => {
  const input = reconstructionRequest(
    identity,
    Array.from({ length: 12500 }, () => response),
    [],
    false,
    Array.from({ length: 12500 }, () => nativeResponse),
  );
  expect(() =>
    validatePacket('NativeStructureReconstructionInput', input),
  ).not.toThrow();
  expect(() =>
    validatePacket('NativeStructureReconstructionInput', {
      ...input,
      native_structure_responses: [
        ...input.native_structure_responses!,
        nativeResponse,
      ],
    }),
  ).toThrow('INVALID_RESULT');
});
