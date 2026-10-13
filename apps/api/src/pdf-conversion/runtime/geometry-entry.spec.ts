import { checksumBuffer } from '../../shared/blob-utils';
import {
  pdfImportConfiguration,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  RECOGNITION_GEOMETRY_REPAIR_POLICY,
} from '../../library/pdf-import/admission/profile';
import {
  geometryParent,
  geometryTask,
} from '../reconstruction/geometry-fixture';
import { exchangeEntry } from './exchange-entry';
import { exchangeStream } from './exchange-stream';
import { exchangeInput, encode, frame } from './exchange-test-fixture';
import type { ExchangeEnvelope } from './exchange-protocol';

function fixture() {
  const configuration = pdfImportConfiguration(
    geometryParent.profile_id,
    NATIVE_LAYOUT_POLICY,
    NATIVE_STRUCTURE_POLICY,
    NATIVE_WORD_WRAP_POLICY,
    RECOGNITION_GEOMETRY_REPAIR_POLICY,
  );
  const job = {
    source: { sha256: geometryParent.source_sha256 },
    profile_id: geometryParent.profile_id,
    config_sha256: checksumBuffer(encode(configuration)),
  };
  const request: Record<string, unknown> = {
    schema_version: 'ava-reconstruct-input-6',
    source_feature_policy: 'ava-ocr-source-features-1',
    source_layout_policy: NATIVE_LAYOUT_POLICY,
    source_structure_policy: NATIVE_STRUCTURE_POLICY,
    source_normalization_policy: NATIVE_WORD_WRAP_POLICY,
    recognition_repair_policy: RECOGNITION_GEOMETRY_REPAIR_POLICY,
    geometry_corrections: [],
    profile_id: job.profile_id,
    source_sha256: job.source.sha256,
    responses: [],
    native_structure_responses: [],
    word_wrap_responses: [],
    refinements: [],
  };
  const input = {
    ...exchangeInput(),
    jobBytes: encode(job),
    auxiliaryBytes: encode({ mode: 'attempt_stream', input: request }),
  };
  return { job, request, input };
}
it('admits Input6 only with its distinct capture and keeps old captures separate', () => {
  const q = fixture();
  expect(exchangeEntry(q.input)).toBe(true);
  const oldHash = checksumBuffer(
    encode(
      pdfImportConfiguration(
        geometryParent.profile_id,
        NATIVE_LAYOUT_POLICY,
        NATIVE_STRUCTURE_POLICY,
        NATIVE_WORD_WRAP_POLICY,
      ),
    ),
  );
  expect(() =>
    exchangeEntry({
      ...q.input,
      jobBytes: encode({ ...q.job, config_sha256: oldHash }),
    }),
  ).toThrow('DISPATCH_NOT_AUTHORIZED');
  delete q.request.recognition_repair_policy;
  delete q.request.geometry_corrections;
  q.request.schema_version = 'ava-reconstruct-input-5';
  const oldInput = {
    ...q.input,
    auxiliaryBytes: encode({ mode: 'attempt_stream', input: q.request }),
  };
  expect(() => exchangeEntry(oldInput)).toThrow('DISPATCH_NOT_AUTHORIZED');
  expect(
    exchangeEntry({
      ...oldInput,
      jobBytes: encode({ ...q.job, config_sha256: oldHash }),
    }),
  ).toBe(true);
});
it.each([
  'missing-policy',
  'missing-proof',
  'prior-proof',
  'wrong-policy',
  'extra',
  'old-marker',
])('rejects Input6 %s before transport dispatch', (change) => {
  const q = fixture();
  if (change === 'missing-policy') delete q.request.recognition_repair_policy;
  else if (change === 'missing-proof') delete q.request.geometry_corrections;
  else if (change === 'prior-proof') q.request.geometry_corrections = [{}];
  else if (change === 'wrong-policy')
    q.request.recognition_repair_policy = 'foreign';
  else if (change === 'extra') q.request.repair = true;
  else q.request.schema_version = 'ava-reconstruct-input-5';
  expect(() =>
    exchangeEntry({
      ...q.input,
      auxiliaryBytes: encode({ mode: 'attempt_stream', input: q.request }),
    }),
  ).toThrow('DISPATCH_NOT_AUTHORIZED');
});
it('crosses the real lower transport through geometry and word-wrap controls before artifacts', async () => {
  const q = fixture(),
    sent: Buffer[] = [];
  q.input.onExchange = jest.fn((bytes) => {
    const request = JSON.parse(bytes.toString()) as ExchangeEnvelope;
    return Promise.resolve(
      request.kind === 'artifacts'
        ? Buffer.alloc(0)
        : encode({
            ...request,
            payload: ['recognition', 'geometry'].includes(request.kind)
              ? [{}]
              : [],
          }),
    );
  });
  const stream = exchangeStream(
    q.input,
    new AbortController().signal,
    (reply) => {
      sent.push(reply);
      return Promise.resolve();
    },
    () => {},
  );
  const controls: [ExchangeEnvelope['kind'], unknown][] = [
    [
      'page',
      { schema_version: 'ava-prepare-result-4', tasks: [geometryParent] },
    ],
    ['recognition', { task_id: geometryParent.task_id }],
    ['geometry', geometryTask],
    ['refinement_batch', { tasks: [] }],
    [
      'word_wrap_batch',
      { schema_version: 'ava-native-word-wrap-batch-1', tasks: [] },
    ],
    ['artifacts', null],
  ];
  for (const [index, [kind, payload]] of controls.entries())
    await stream.write(
      frame({
        schema_version:
          kind === 'geometry'
            ? 'ava-recognition-geometry-exchange-1'
            : 'ava-reconstruction-exchange-2',
        sequence: index + 1,
        source_sha256: q.job.source.sha256,
        profile_id: q.job.profile_id,
        kind,
        payload,
      }),
    );
  expect(stream.finish()).toBeUndefined();
  expect(q.input.onExchange).toHaveBeenCalledTimes(6);
  expect(sent).toHaveLength(5);
});
