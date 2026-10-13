import { checksumBuffer } from '../../shared/blob-utils';
import {
  PDF_IMPORT_PROFILE,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
  pdfImportConfiguration,
} from '../../library/pdf-import/admission/profile';
import { exchangeEntry } from './exchange-entry';
import { exchangeInput, encode, envelope } from './exchange-test-fixture';

function setup() {
  const input = exchangeInput();
  const configuration = pdfImportConfiguration(
    PDF_IMPORT_PROFILE.profileId,
    NATIVE_LAYOUT_POLICY,
    NATIVE_STRUCTURE_POLICY,
  );
  const job = {
    source: { sha256: envelope().source_sha256 },
    profile_id: configuration.profileId,
    config_sha256: checksumBuffer(Buffer.from(JSON.stringify(configuration))),
  };
  const request = {
    schema_version: 'ava-reconstruct-input-4',
    source_feature_policy: 'ava-ocr-source-features-1',
    source_layout_policy: NATIVE_LAYOUT_POLICY,
    source_structure_policy: NATIVE_STRUCTURE_POLICY,
    profile_id: job.profile_id,
    source_sha256: job.source.sha256,
    responses: [],
    native_structure_responses: [],
    refinements: [],
  };
  const enter = (receipt: object = request, captured: object = job) =>
    exchangeEntry({
      ...input,
      jobBytes: encode(captured),
      auxiliaryBytes: encode({ mode: 'attempt_stream', input: receipt }),
    });
  return { enter, job, request };
}

it('admits only the separately captured Input4 configuration with empty native receipts', () => {
  expect(setup().enter()).toBe(true);
});
it.each([
  'old-config',
  'profile',
  'layout',
  'structure',
  'feature',
  'receipt',
  'missing',
  'extra',
  'downgrade',
])('refuses current native entry %s', (change) => {
  const q = setup();
  const job: Record<string, unknown> = { ...q.job };
  const request: Record<string, unknown> = { ...q.request };
  if (change === 'old-config')
    job.config_sha256 = checksumBuffer(
      Buffer.from(
        JSON.stringify(
          pdfImportConfiguration(q.job.profile_id, NATIVE_LAYOUT_POLICY),
        ),
      ),
    );
  if (change === 'profile') request.profile_id = 'ava-pdf-prose-en-uk-v3';
  if (change === 'layout') request.source_layout_policy = 'unknown';
  if (change === 'structure') request.source_structure_policy = 'unknown';
  if (change === 'feature') delete request.source_feature_policy;
  if (change === 'receipt') request.native_structure_responses = [{}];
  if (change === 'missing') delete request.native_structure_responses;
  if (change === 'extra') request.private_snapshot = {};
  if (change === 'downgrade') {
    request.schema_version = 'ava-reconstruct-input-3';
    delete request.native_structure_responses;
    delete request.source_structure_policy;
  }
  expect(() => q.enter(request, job)).toThrow('DISPATCH_NOT_AUTHORIZED');
});
