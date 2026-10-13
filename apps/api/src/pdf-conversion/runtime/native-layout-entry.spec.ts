import { checksumBuffer } from '../../shared/blob-utils';
import { PDF_IMPORT_PROFILE } from '../../library/pdf-import/admission/profile';
import { exchangeEntry } from './exchange-entry';
import { exchangeInput, encode, envelope } from './exchange-test-fixture';
const policy = 'ava-native-layout-1';
function current() {
  const input = exchangeInput();
  const job = {
    source: { sha256: envelope().source_sha256 },
    profile_id: PDF_IMPORT_PROFILE.profileId,
    config_sha256: checksumBuffer(
      Buffer.from(
        JSON.stringify({ ...PDF_IMPORT_PROFILE, sourceLayoutPolicy: policy }),
      ),
    ),
  };
  const request = {
    schema_version: 'ava-reconstruct-input-3',
    source_feature_policy: 'ava-ocr-source-features-1',
    source_layout_policy: policy,
    profile_id: job.profile_id,
    source_sha256: job.source.sha256,
    responses: [],
    refinements: [],
  };
  return { input, job, request };
}
it('allows only captured Input3 policy with empty initial receipts', () => {
  const q = current();
  expect(
    exchangeEntry({
      ...q.input,
      jobBytes: encode(q.job),
      auxiliaryBytes: encode({ mode: 'attempt_stream', input: q.request }),
    }),
  ).toBe(true);
});
it.each(['config', 'policy', 'feature', 'version', 'receipt', 'extra'])(
  'refuses changed initial policy binding %s',
  (change) => {
    const q = current();
    const job: Record<string, unknown> = { ...q.job };
    const request: Record<string, unknown> = { ...q.request };
    if (change === 'config') job.config_sha256 = 'b'.repeat(64);
    if (change === 'policy') request.source_layout_policy = 'unknown';
    if (change === 'feature') delete request.source_feature_policy;
    if (change === 'version')
      request.schema_version = 'ava-reconstruct-input-1';
    if (change === 'receipt') request.refinements = [{}];
    if (change === 'extra') request.native_layout_responses = [];
    expect(() =>
      exchangeEntry({
        ...q.input,
        jobBytes: encode(job),
        auxiliaryBytes: encode({ mode: 'attempt_stream', input: request }),
      }),
    ).toThrow('DISPATCH_NOT_AUTHORIZED');
  },
);
