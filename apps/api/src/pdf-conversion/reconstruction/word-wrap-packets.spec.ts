import { reconstructionRequest } from './reconstruction-request';
import { wrapAttempt } from './word-wrap-attempt-fixture';
import { wrapResponses } from './word-wrap-fixture';
import { validatePacket } from './validate-packet';

it('selects closed Input5 and Prepare4 only for captured normalization authority', () => {
  const q = wrapAttempt();
  const request = reconstructionRequest(
    q.context,
    [],
    [],
    false,
    [],
    wrapResponses,
  );
  expect(
    validatePacket('NativeWordWrapReconstructionInput', request)
      .word_wrap_responses,
  ).toEqual(wrapResponses);
  expect(validatePacket('NativeWordWrapPrepareResult', q.page).tasks).toEqual(
    [],
  );
  expect(() =>
    validatePacket('NativeStructurePrepareResult', {
      ...q.page,
      schema_version: 'ava-prepare-result-3',
    }),
  ).toThrow('INVALID_RESULT');
  expect(() =>
    validatePacket('NativeStructureReconstructionInput', {
      ...request,
      schema_version: 'ava-reconstruct-input-4',
    }),
  ).toThrow('INVALID_RESULT');
  expect(() =>
    validatePacket('NativeWordWrapReconstructionInput', {
      ...request,
      word_wrap_responses: undefined,
    }),
  ).toThrow('INVALID_RESULT');
  expect(() =>
    validatePacket('NativeWordWrapReconstructionInput', {
      ...request,
      word_wrap_responses: Array.from({ length: 33 }, () => wrapResponses[0]),
    }),
  ).toThrow('INVALID_RESULT');
});
