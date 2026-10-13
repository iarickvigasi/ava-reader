import { checksumBuffer } from '../../shared/blob-utils';
import {
  pdfImportConfiguration,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
  NATIVE_WORD_WRAP_POLICY,
} from '../../library/pdf-import/admission/profile';
import { exchangeEntry } from './exchange-entry';
import { exchangeInput, encode, envelope } from './exchange-test-fixture';

function setup() {
  const configuration = pdfImportConfiguration(
    undefined,
    NATIVE_LAYOUT_POLICY,
    NATIVE_STRUCTURE_POLICY,
    NATIVE_WORD_WRAP_POLICY,
  );
  const job = {
    source: { sha256: envelope().source_sha256 },
    profile_id: configuration.profileId,
    config_sha256: checksumBuffer(Buffer.from(JSON.stringify(configuration))),
  };
  const request = {
    schema_version: 'ava-reconstruct-input-5',
    source_feature_policy: 'ava-ocr-source-features-1',
    source_layout_policy: NATIVE_LAYOUT_POLICY,
    source_structure_policy: NATIVE_STRUCTURE_POLICY,
    source_normalization_policy: NATIVE_WORD_WRAP_POLICY,
    profile_id: job.profile_id,
    source_sha256: job.source.sha256,
    responses: [],
    native_structure_responses: [],
    word_wrap_responses: [],
    refinements: [],
  };
  const enter = (value: object = request, captured: object = job) =>
    exchangeEntry({
      ...exchangeInput(),
      jobBytes: encode(captured),
      auxiliaryBytes: encode({ mode: 'attempt_stream', input: value }),
    });
  return { request, job, enter };
}
it('admits Input5 only for its separately captured configuration', () =>
  expect(setup().enter()).toBe(true));
it.each(['old-config', 'downgrade', 'missing', 'receipt', 'policy', 'extra'])(
  'refuses normalization entry %s',
  (change) => {
    const q = setup();
    const request: Record<string, unknown> = { ...q.request };
    const job = { ...q.job };
    if (change === 'old-config')
      job.config_sha256 = checksumBuffer(
        Buffer.from(
          JSON.stringify(
            pdfImportConfiguration(
              undefined,
              NATIVE_LAYOUT_POLICY,
              NATIVE_STRUCTURE_POLICY,
            ),
          ),
        ),
      );
    if (change === 'downgrade') {
      request.schema_version = 'ava-reconstruct-input-4';
      delete request.source_normalization_policy;
      delete request.word_wrap_responses;
    }
    if (change === 'missing') delete request.word_wrap_responses;
    if (change === 'receipt') request.word_wrap_responses = [{}];
    if (change === 'policy') request.source_normalization_policy = 'unknown';
    if (change === 'extra') request.catalogue = {};
    expect(() => q.enter(request, job)).toThrow('DISPATCH_NOT_AUTHORIZED');
  },
);
