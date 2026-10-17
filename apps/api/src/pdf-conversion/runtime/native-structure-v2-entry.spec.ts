import { checksumBuffer } from '../../shared/blob-utils';
import {
  pdfImportConfiguration,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_V2_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  RECOGNITION_GEOMETRY_REPAIR_POLICY,
  FRONTMATTER_TITLE_POLICY,
} from '../../library/pdf-import/admission/profile';
import { nativeTask2 } from '../reconstruction/native-structure-v2-fixture';
import { reconstructionRequest } from '../reconstruction/reconstruction-request';
import { exchangeEntry } from './exchange-entry';
import { exchangeStream } from './exchange-stream';
import type { ExchangeEnvelope } from './exchange-protocol';
import { exchangeProtocol, exchangeReply } from './exchange-protocol';
import { exchangeInput, encode, frame } from './exchange-test-fixture';

const policies = {
  sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
  sourceStructurePolicy: NATIVE_STRUCTURE_V2_POLICY,
  sourceNormalizationPolicy: NATIVE_WORD_WRAP_POLICY,
  recognitionRepairPolicy: RECOGNITION_GEOMETRY_REPAIR_POLICY,
  sourceTitlePolicy: FRONTMATTER_TITLE_POLICY,
};
function setup() {
  const configuration = pdfImportConfiguration(
    nativeTask2.profile_id,
    NATIVE_LAYOUT_POLICY,
    NATIVE_STRUCTURE_V2_POLICY,
    NATIVE_WORD_WRAP_POLICY,
    RECOGNITION_GEOMETRY_REPAIR_POLICY,
    FRONTMATTER_TITLE_POLICY,
  );
  const job = {
    source: { sha256: nativeTask2.source_sha256 },
    profile_id: nativeTask2.profile_id,
    config_sha256: checksumBuffer(Buffer.from(JSON.stringify(configuration))),
  };
  const request = reconstructionRequest({
    profileId: job.profile_id,
    sourceSha256: job.source.sha256,
    ...policies,
  });
  const enter = (body: object = request, captured: object = job) =>
    exchangeEntry({
      ...exchangeInput(),
      jobBytes: encode(captured),
      auxiliaryBytes: encode({ mode: 'attempt_stream', input: body }),
    });
  return { job, request, enter };
}
it('admits only new full-feature Input8 and exact captured identity', () => {
  expect(setup().enter()).toBe(true);
});
it.each([
  'old-config',
  'downgrade',
  'old-structure',
  'missing-title',
  'missing-wrap',
  'missing-geometry',
  'prior-native',
  'extra',
])('refuses Native2 entry %s', (change) => {
  const q = setup(),
    request: Record<string, unknown> = { ...q.request },
    job: Record<string, unknown> = { ...q.job };
  if (change === 'old-config')
    job.config_sha256 =
      '5fed6a113e4851d26b843716cf48bbddf954e64155c82fd0655e63607600b8d4';
  if (change === 'downgrade')
    request.schema_version = 'ava-reconstruct-input-7';
  if (change === 'old-structure')
    request.source_structure_policy = 'ava-native-structure-1';
  if (change === 'missing-title') delete request.source_title_policy;
  if (change === 'missing-wrap') delete request.word_wrap_responses;
  if (change === 'missing-geometry') delete request.geometry_corrections;
  if (change === 'prior-native') request.native_structure_responses = [{}];
  if (change === 'extra') request.repair_policy = 'unknown';
  expect(() => q.enter(request, job)).toThrow('DISPATCH_NOT_AUTHORIZED');
});
const binding = {
  source_sha256: nativeTask2.source_sha256,
  profile_id: nativeTask2.profile_id,
};
const page = {
  ...binding,
  schema_version: 'ava-reconstruction-exchange-2',
  sequence: 1,
  kind: 'page',
  payload: { schema_version: 'ava-prepare-result-5', tasks: [nativeTask2] },
};
const task = {
  ...binding,
  schema_version: 'ava-native-structure-exchange-2',
  sequence: 2,
  kind: 'native_structure',
  payload: { task_id: nativeTask2.task_id },
};
it('binds new native namespace and reply to its advertised Task2 with shared sequence', () => {
  const protocol = exchangeProtocol(binding, true, true, true);
  protocol.accept(encode(page));
  const accepted = protocol.accept(encode(task));
  expect(
    exchangeReply(encode({ ...task, payload: [{}] }), accepted).length,
  ).toBeGreaterThan(4);
  expect(() =>
    exchangeReply(
      encode({
        ...task,
        schema_version: 'ava-native-structure-exchange-1',
        payload: [{}],
      }),
      accepted,
    ),
  ).toThrow('INVALID_RESULT');
});
it.each([
  'legacy-control',
  'legacy-prepare',
  'legacy-task',
  'recognition-kind',
])('refuses Native2 transport %s before any dispatch', (change) => {
  const protocol = exchangeProtocol(binding, true, true, true);
  const badPage = structuredClone(page),
    badTask = structuredClone(task);
  if (change === 'legacy-prepare') {
    badPage.payload.schema_version = 'ava-prepare-result-4';
    expect(() => protocol.accept(encode(badPage))).toThrow('INVALID_RESULT');
    return;
  }
  if (change === 'legacy-task') {
    const value = {
      ...page,
      payload: {
        ...page.payload,
        tasks: [
          { ...nativeTask2, schema_version: 'ava-native-structure-task-1' },
        ],
      },
    };
    expect(() => protocol.accept(encode(value))).toThrow('INVALID_RESULT');
    return;
  }
  protocol.accept(encode(page));
  if (change === 'legacy-control')
    badTask.schema_version = 'ava-native-structure-exchange-1';
  if (change === 'recognition-kind') badTask.kind = 'recognition';
  expect(() => protocol.accept(encode(badTask))).toThrow('INVALID_RESULT');
});
it('keeps historical transports closed to Prepare5 and Task2', () => {
  expect(() =>
    exchangeProtocol(binding, true, true).accept(encode(page)),
  ).toThrow('INVALID_RESULT');
  expect(() => exchangeProtocol(binding, false, false, true)).toThrow(
    'DISPATCH_NOT_AUTHORIZED',
  );
});

it('crosses the real Input8 framed stream through native2 and the remaining finite phases', async () => {
  const q = setup(),
    sent: Buffer[] = [];
  const input = {
    ...exchangeInput(),
    jobBytes: encode(q.job),
    auxiliaryBytes: encode({ mode: 'attempt_stream', input: q.request }),
  };
  input.onExchange = jest.fn((bytes) => {
    const request = JSON.parse(bytes.toString()) as ExchangeEnvelope;
    return Promise.resolve(
      request.kind === 'artifacts'
        ? Buffer.alloc(0)
        : encode({
            ...request,
            payload: request.kind === 'native_structure' ? [{}] : [],
          }),
    );
  });
  const stream = exchangeStream(
    input,
    new AbortController().signal,
    (reply) => {
      sent.push(reply);
      return Promise.resolve();
    },
    () => {},
  );
  const controls: [ExchangeEnvelope['kind'], unknown][] = [
    ['page', page.payload],
    ['native_structure', task.payload],
    [
      'refinement_batch',
      { schema_version: 'ava-book-refinement-batch-3', tasks: [] },
    ],
    [
      'word_wrap_batch',
      { schema_version: 'ava-native-word-wrap-batch-1', tasks: [] },
    ],
    ['artifacts', null],
  ];
  for (const [index, [kind, payload]] of controls.entries())
    await stream.write(
      frame({
        ...binding,
        schema_version:
          kind === 'native_structure'
            ? 'ava-native-structure-exchange-2'
            : 'ava-reconstruction-exchange-2',
        sequence: index + 1,
        kind,
        payload,
      }),
    );
  expect(stream.finish()).toBeUndefined();
  expect(input.onExchange).toHaveBeenCalledTimes(5);
  expect(sent).toHaveLength(4);
});
