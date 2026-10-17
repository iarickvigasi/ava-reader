import { reconstructionRequest } from './reconstruction-request';
import { validatePacket } from './validate-packet';
import { nativeTask, nativeResponse } from './native-structure-fixture';
import { task, response, prepared } from './test-fixture';
import { nativeAttempt } from './native-structure-attempt-fixture';
const identity = {
  sourceSha256: nativeTask.source_sha256,
  profileId: nativeTask.profile_id,
  sourceLayoutPolicy: 'ava-native-layout-1' as const,
  sourceStructurePolicy: 'ava-native-structure-1' as const,
};

it('selects explicit Input4 and keeps native receipts outside RecognitionResponse2', () => {
  const input = reconstructionRequest(identity, [response], [], false, [
    nativeResponse,
  ]);
  expect(input).toMatchObject({
    schema_version: 'ava-reconstruct-input-4',
    source_layout_policy: 'ava-native-layout-1',
    source_structure_policy: 'ava-native-structure-1',
    native_structure_responses: [nativeResponse],
    responses: [response],
  });
  expect(validatePacket('NativeStructureReconstructionInput', input)).toEqual(
    input,
  );
  for (const name of [
    'ReconstructionInput',
    'PrintedTitleReconstructionInput',
    'NativeLayoutReconstructionInput',
  ] as const)
    expect(() => validatePacket(name, input)).toThrow('INVALID_RESULT');
});

it('keeps historical Prepare1/2 and Input3 contracts closed while Prepare3 admits a typed mixed task list', () => {
  const page = { ...nativeAttempt().page, tasks: [nativeTask, task] };
  expect(validatePacket('NativeStructurePrepareResult', page)).toEqual(page);
  expect(() =>
    validatePacket('PrepareResult', { ...prepared, tasks: [nativeTask] }),
  ).toThrow('INVALID_RESULT');
  expect(() =>
    validatePacket('NativeLayoutPrepareResult', {
      ...prepared,
      schema_version: 'ava-prepare-result-2',
      source_layout_policy: identity.sourceLayoutPolicy,
      tasks: [nativeTask],
    }),
  ).toThrow('INVALID_RESULT');
  const historical = {
    schema_version: 'ava-reconstruct-input-3',
    source_layout_policy: identity.sourceLayoutPolicy,
    source_feature_policy: 'ava-ocr-source-features-1',
    profile_id: identity.profileId,
    source_sha256: identity.sourceSha256,
    responses: [],
    refinements: [],
  };
  expect(validatePacket('NativeLayoutReconstructionInput', historical)).toEqual(
    historical,
  );
  expect(() =>
    validatePacket('NativeLayoutReconstructionInput', {
      ...historical,
      native_structure_responses: [],
    }),
  ).toThrow('INVALID_RESULT');
});

it.each([
  'source_layout_policy',
  'source_structure_policy',
  'native_structure_responses',
])('requires explicit current field %s', (field) => {
  const input: Record<string, unknown> = reconstructionRequest(identity);
  delete input[field];
  expect(() =>
    validatePacket('NativeStructureReconstructionInput', input),
  ).toThrow('INVALID_RESULT');
});
