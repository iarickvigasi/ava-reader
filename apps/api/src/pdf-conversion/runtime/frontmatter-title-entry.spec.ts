import { checksumBuffer } from '../../shared/blob-utils';
import {
  FRONTMATTER_TITLE_POLICY,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  pdfImportConfiguration,
  RECOGNITION_GEOMETRY_REPAIR_POLICY,
} from '../../library/pdf-import/admission/profile';
import {
  geometryParent,
  geometryTask,
} from '../reconstruction/geometry-fixture';
import { exchangeEntry } from './exchange-entry';
import { exchangeStream } from './exchange-stream';
import { encode, exchangeInput, frame } from './exchange-test-fixture';
import type { ExchangeEnvelope } from './exchange-protocol';

const captures = [
  {
    profile: 'ava-pdf-prose-en-v2',
    hash: 'd8bb90385b949c5bf22eefafdb427ff3a76a25ba3e8ce006f1e28c3c7f348e5b',
  },
  {
    profile: 'ava-pdf-prose-en-uk-v3',
    hash: '5fed6a113e4851d26b843716cf48bbddf954e64155c82fd0655e63607600b8d4',
  },
] as const;
const policyKeys = [
  'source_feature_policy',
  'source_layout_policy',
  'source_structure_policy',
  'source_normalization_policy',
  'recognition_repair_policy',
  'source_title_policy',
] as const;
const receiptKeys = [
  'responses',
  'refinements',
  'native_structure_responses',
  'word_wrap_responses',
  'geometry_corrections',
] as const;
function fixture(profile: string, sourceSha256 = 'a'.repeat(64)) {
  const capture = captures.find((candidate) => candidate.profile === profile)!;
  const job = {
    source: { sha256: sourceSha256 },
    profile_id: profile,
    config_sha256: capture.hash,
  };
  const request: Record<string, unknown> = {
    schema_version: 'ava-reconstruct-input-7',
    profile_id: profile,
    source_sha256: sourceSha256,
    source_feature_policy: 'ava-ocr-source-features-1',
    source_layout_policy: NATIVE_LAYOUT_POLICY,
    source_structure_policy: NATIVE_STRUCTURE_POLICY,
    source_normalization_policy: NATIVE_WORD_WRAP_POLICY,
    recognition_repair_policy: RECOGNITION_GEOMETRY_REPAIR_POLICY,
    source_title_policy: FRONTMATTER_TITLE_POLICY,
    responses: [],
    refinements: [],
    native_structure_responses: [],
    word_wrap_responses: [],
    geometry_corrections: [],
  };
  const input = {
    ...exchangeInput(),
    jobBytes: encode(job),
    auxiliaryBytes: encode({ mode: 'attempt_stream', input: request }),
  };
  return { job, request, input };
}
function historicalConfiguration(profile: string, marker: number) {
  return pdfImportConfiguration(
    profile,
    marker >= 3 ? NATIVE_LAYOUT_POLICY : undefined,
    marker >= 4 ? NATIVE_STRUCTURE_POLICY : undefined,
    marker >= 5 ? NATIVE_WORD_WRAP_POLICY : undefined,
    marker >= 6 ? RECOGNITION_GEOMETRY_REPAIR_POLICY : undefined,
  );
}
function historicalRequest(q: ReturnType<typeof fixture>, marker: number) {
  const request: Record<string, unknown> = {
    schema_version: `ava-reconstruct-input-${marker}`,
    profile_id: q.job.profile_id,
    source_sha256: q.job.source.sha256,
    source_feature_policy: 'ava-ocr-source-features-1',
    responses: [],
    refinements: [],
  };
  if (marker >= 3) request.source_layout_policy = NATIVE_LAYOUT_POLICY;
  if (marker >= 4) {
    request.source_structure_policy = NATIVE_STRUCTURE_POLICY;
    request.native_structure_responses = [];
  }
  if (marker >= 5) {
    request.source_normalization_policy = NATIVE_WORD_WRAP_POLICY;
    request.word_wrap_responses = [];
  }
  if (marker >= 6) {
    request.recognition_repair_policy = RECOGNITION_GEOMETRY_REPAIR_POLICY;
    request.geometry_corrections = [];
  }
  return request;
}
function inputWith(
  q: ReturnType<typeof fixture>,
  request = q.request,
  configHash: string = q.job.config_sha256,
) {
  return {
    ...q.input,
    jobBytes: encode({ ...q.job, config_sha256: configHash }),
    auxiliaryBytes: encode({ mode: 'attempt_stream', input: request }),
  };
}

describe.each(captures)('$profile Input7 lower entry', ({ profile, hash }) => {
  it('admits only its exact captured empty initial authority', () => {
    const q = fixture(profile);
    expect(exchangeEntry(q.input)).toBe(true);
    const other = captures.find((capture) => capture.profile !== profile)!;
    expect(() => exchangeEntry(inputWith(q, q.request, other.hash))).toThrow(
      'DISPATCH_NOT_AUTHORIZED',
    );
  });
  it('rejects every preceding capture paired with Input7', () => {
    const q = fixture(profile);
    for (const marker of [1, 3, 4, 5, 6]) {
      const priorHash = checksumBuffer(
        encode(historicalConfiguration(profile, marker)),
      );
      expect(priorHash).not.toBe(hash);
      expect(() => exchangeEntry(inputWith(q, q.request, priorHash))).toThrow(
        'DISPATCH_NOT_AUTHORIZED',
      );
    }
  });
  it.each([1, 2, 3, 4, 5, 6])(
    'rejects the new capture paired with historical Input%s',
    (marker) => {
      const q = fixture(profile);
      expect(() =>
        exchangeEntry(inputWith(q, historicalRequest(q, marker))),
      ).toThrow('DISPATCH_NOT_AUTHORIZED');
    },
  );
  it('keeps old admitted entries separate and forbids title fields in their packets', () => {
    const q = fixture(profile);
    for (const marker of [1, 3, 4, 5, 6]) {
      const request = historicalRequest(q, marker);
      const priorHash = checksumBuffer(
        encode(historicalConfiguration(profile, marker)),
      );
      expect(exchangeEntry(inputWith(q, request, priorHash))).toBe(true);
      expect(() =>
        exchangeEntry(
          inputWith(
            q,
            { ...request, source_title_policy: FRONTMATTER_TITLE_POLICY },
            priorHash,
          ),
        ),
      ).toThrow('DISPATCH_NOT_AUTHORIZED');
    }
  });
  it.each(policyKeys)('rejects missing or foreign %s', (key) => {
    const q = fixture(profile);
    const missing = { ...q.request };
    delete missing[key];
    for (const request of [missing, { ...q.request, [key]: 'foreign' }])
      expect(() => exchangeEntry(inputWith(q, request))).toThrow(
        'DISPATCH_NOT_AUTHORIZED',
      );
  });
  it.each(receiptKeys)(
    'rejects missing or prior %s before transport starts',
    (key) => {
      const q = fixture(profile);
      const missing = { ...q.request };
      delete missing[key];
      for (const request of [missing, { ...q.request, [key]: [{}] }]) {
        const input = {
          ...inputWith(q, request),
          onExchange: jest.fn(q.input.onExchange),
        };
        expect(() =>
          exchangeStream(
            input,
            new AbortController().signal,
            () => Promise.resolve(),
            () => {},
          ),
        ).toThrow('DISPATCH_NOT_AUTHORIZED');
        expect(input.onExchange).not.toHaveBeenCalled();
      }
    },
  );
  it('rejects extra authority and changed job source binding', () => {
    const q = fixture(profile);
    expect(() =>
      exchangeEntry(inputWith(q, { ...q.request, title_override: 'invented' })),
    ).toThrow('DISPATCH_NOT_AUTHORIZED');
    expect(() =>
      exchangeEntry({
        ...q.input,
        jobBytes: encode({ ...q.job, source: { sha256: 'b'.repeat(64) } }),
      }),
    ).toThrow('DISPATCH_NOT_AUTHORIZED');
  });
});

async function crossTransport(
  q: ReturnType<typeof fixture>,
  controls: [ExchangeEnvelope['kind'], unknown][],
) {
  const sent: Buffer[] = [];
  const onExchange = jest.fn((bytes: Buffer) => {
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
  const input = { ...q.input, onExchange };
  const stream = exchangeStream(
    input,
    new AbortController().signal,
    (reply) => {
      sent.push(reply);
      return Promise.resolve();
    },
    () => {},
  );
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
  expect(stream.artifacts).toBe(true);
  expect(onExchange).toHaveBeenCalledTimes(controls.length);
  expect(sent).toHaveLength(controls.length - 1);
}
function terminalControls(
  q: ReturnType<typeof fixture>,
): [ExchangeEnvelope['kind'], unknown][] {
  return [
    [
      'refinement_batch',
      {
        schema_version: 'ava-book-refinement-batch-3',
        source_sha256: q.job.source.sha256,
        source_title_policy: FRONTMATTER_TITLE_POLICY,
        tasks: [],
      },
    ],
    [
      'word_wrap_batch',
      { schema_version: 'ava-native-word-wrap-batch-1', tasks: [] },
    ],
    ['artifacts', null],
  ];
}
// These frames exercise the actual lower transport, not Title2 classification or source assembly.
it.each(captures)(
  'crosses Input7 word-wrap transport for $profile before artifacts',
  async ({ profile }) => {
    const q = fixture(profile);
    await crossTransport(q, [
      ['page', { schema_version: 'ava-prepare-result-4', tasks: [] }],
      ...terminalControls(q),
    ]);
  },
);
it('retains the geometry exchange mode under Input7 before word-wrap and artifacts', async () => {
  const q = fixture(geometryParent.profile_id, geometryParent.source_sha256);
  await crossTransport(q, [
    [
      'page',
      { schema_version: 'ava-prepare-result-4', tasks: [geometryParent] },
    ],
    ['recognition', { task_id: geometryParent.task_id }],
    ['geometry', geometryTask],
    ...terminalControls(q),
  ]);
});
