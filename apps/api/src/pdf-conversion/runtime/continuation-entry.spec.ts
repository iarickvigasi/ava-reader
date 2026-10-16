import { checksumBuffer } from '../../shared/blob-utils';
import {
  pdfImportConfiguration,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_V2_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  FRONTMATTER_TITLE_POLICY,
  RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
  SOURCE_CONTINUATION_POLICY,
} from '../../library/pdf-import/admission/profile';
import { capturedSourcePolicies } from '../../library/pdf-import/admission/captured-source-policies';
import { reconstructionRequest } from '../reconstruction/reconstruction-request';
import {
  continuationTask,
  continuationResponse,
} from '../reconstruction/continuation-fixture';
import { refineAttemptTask } from '../reconstruction/attempt-provider';
import { titleAttempt } from '../reconstruction/frontmatter-attempt-fixture';
import { validatePacket } from '../reconstruction/validate-packet';
import { exchangeInput, encode } from './exchange-test-fixture';
import { exchangeEntry } from './exchange-entry';

function configuration(current = true) {
  return pdfImportConfiguration(
    continuationTask.profile_id,
    NATIVE_LAYOUT_POLICY,
    NATIVE_STRUCTURE_V2_POLICY,
    NATIVE_WORD_WRAP_POLICY,
    RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
    FRONTMATTER_TITLE_POLICY,
    current ? SOURCE_CONTINUATION_POLICY : undefined,
  );
}
function fixture(current = true) {
  const config = configuration(current),
    hash = checksumBuffer(encode(config));
  const identity = {
    sourceSha256: continuationTask.source_sha256,
    profileId: continuationTask.profile_id,
    ...capturedSourcePolicies(continuationTask.profile_id, hash),
  };
  const request = reconstructionRequest(identity);
  return {
    request,
    identity,
    input: {
      ...exchangeInput(),
      jobBytes: encode({
        source: { sha256: identity.sourceSha256 },
        profile_id: identity.profileId,
        config_sha256: hash,
      }),
      auxiliaryBytes: encode({ mode: 'attempt_stream', input: request }),
    },
  };
}
it('binds Input10 to its exact new capture while preserving Input9 bytes and authority', () => {
  const q = fixture(),
    old = fixture(false);
  expect(q.request.schema_version).toBe('ava-reconstruct-input-10');
  expect(old.request.schema_version).toBe('ava-reconstruct-input-9');
  expect(old.identity).not.toHaveProperty('sourceContinuationPolicy');
  expect(exchangeEntry(q.input)).toBe(true);
  expect(exchangeEntry(old.input)).toBe(true);
  expect(() =>
    exchangeEntry({ ...q.input, jobBytes: old.input.jobBytes }),
  ).toThrow('DISPATCH_NOT_AUTHORIZED');
  expect(() =>
    exchangeEntry({ ...old.input, jobBytes: q.input.jobBytes }),
  ).toThrow('DISPATCH_NOT_AUTHORIZED');
  expect(() =>
    validatePacket('CellGeometryReconstructionInput', q.request),
  ).toThrow();
  expect(validatePacket('ContinuationReconstructionInput', q.request)).toEqual(
    q.request,
  );
  for (const value of [undefined, '', 'foreign']) {
    expect(() =>
      exchangeEntry({
        ...q.input,
        auxiliaryBytes: encode({
          mode: 'attempt_stream',
          input: { ...q.request, source_continuation_policy: value },
        }),
      }),
    ).toThrow('DISPATCH_NOT_AUTHORIZED');
  }
});
it('validates the exact new contract before paid dispatch and after receiving it', async () => {
  const q = titleAttempt(),
    validate = jest.fn(() => Promise.resolve());
  const context = {
    ...q.context,
    sourceSha256: continuationTask.source_sha256,
    sourceContinuationPolicy: SOURCE_CONTINUATION_POLICY,
    validateContinuation: validate,
  };
  q.dispatch.mockResolvedValue({
    output: JSON.stringify(continuationResponse),
  });
  await expect(
    refineAttemptTask(continuationTask, context, new AbortController().signal),
  ).resolves.toEqual(continuationResponse);
  expect(validate.mock.calls).toHaveLength(2);
  expect(validate.mock.invocationCallOrder[0]).toBeLessThan(
    q.dispatch.mock.invocationCallOrder[0],
  );
  expect(validate.mock.invocationCallOrder[1]).toBeGreaterThan(
    q.dispatch.mock.invocationCallOrder[0],
  );
  q.dispatch.mockClear();
  validate.mockRejectedValueOnce(new Error('rejected'));
  await expect(
    refineAttemptTask(continuationTask, context, new AbortController().signal),
  ).rejects.toThrow('rejected');
  expect(q.dispatch).not.toHaveBeenCalled();
  await expect(
    refineAttemptTask(
      continuationTask,
      { ...context, sourceContinuationPolicy: undefined },
      new AbortController().signal,
    ),
  ).rejects.toThrow('DISPATCH_NOT_AUTHORIZED');
});
it('refuses partial and unknown continuation configurations', () => {
  for (const policy of ['foreign', 1, false, null])
    expect(() =>
      pdfImportConfiguration(
        continuationTask.profile_id,
        NATIVE_LAYOUT_POLICY,
        NATIVE_STRUCTURE_V2_POLICY,
        NATIVE_WORD_WRAP_POLICY,
        RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
        FRONTMATTER_TITLE_POLICY,
        policy,
      ),
    ).toThrow('PDF_IMPORT_PROFILE_INVALID');
  expect(() =>
    pdfImportConfiguration(
      continuationTask.profile_id,
      NATIVE_LAYOUT_POLICY,
      NATIVE_STRUCTURE_V2_POLICY,
      NATIVE_WORD_WRAP_POLICY,
      RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
      undefined,
      SOURCE_CONTINUATION_POLICY,
    ),
  ).toThrow('PDF_IMPORT_PROFILE_INVALID');
});
