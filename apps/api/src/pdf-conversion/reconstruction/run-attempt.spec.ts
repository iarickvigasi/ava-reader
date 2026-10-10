import { runReconstruction } from './run-reconstruction';
import { attemptCandidateFixture } from './attempt-candidate-fixture';
import type { CoordinatorDependencies } from './coordinator-types';
import { PdfRuntimeError } from '../runtime/runtime-error';
import type { ExchangeEnvelope } from '../runtime/exchange-protocol';
import type { WorkerResultV1 } from '../contracts/generated/ava-pdf-worker-result-1';
import type { SemanticValidator } from '../contracts/types';

function setup(currentPolicy = true) {
  const fixture = attemptCandidateFixture(currentPolicy);
  const jobController = new AbortController();
  const session = new AbortController();
  let sequence = 0;
  const dispatch = jest.fn();
  const progress = jest.fn(() => Promise.resolve());
  const stage = jest.fn<
    ReturnType<CoordinatorDependencies['stageArtifact']>,
    Parameters<CoordinatorDependencies['stageArtifact']>
  >((descriptor) => Promise.resolve('staged-' + descriptor.path));
  const sandbox = jest.fn<
    ReturnType<CoordinatorDependencies['sandbox']>,
    Parameters<CoordinatorDependencies['sandbox']>
  >();
  const send = async (
    input: Parameters<CoordinatorDependencies['sandbox']>[0],
    kind: string,
    payload: unknown,
  ) => {
    return input.onExchange!(
      Buffer.from(
        JSON.stringify({
          schema_version: 'ava-reconstruction-exchange-1',
          sequence: ++sequence,
          source_sha256: fixture.job.source.sha256,
          profile_id: fixture.job.profile_id,
          kind,
          payload,
        }),
      ),
      session.signal,
    );
  };
  const prepare = async (
    input: Parameters<CoordinatorDependencies['sandbox']>[0],
  ) => {
    expect(
      (JSON.parse(input.auxiliaryBytes!.toString()) as { mode: string }).mode,
    ).toBe('attempt_stream');
    for (let page = 1; page <= fixture.book.pages.length; page++) {
      const reply = await send(input, 'page', {
        schema_version: 'ava-prepare-result-1',
        source_sha256: fixture.job.source.sha256,
        profile_id: fixture.job.profile_id,
        source_page_count: fixture.book.pages.length,
        page_number: page,
        observation_sha256: 'a'.repeat(64),
        native_segment_count: 2,
        tasks: [],
      });
      expect(
        (JSON.parse(reply.toString()) as ExchangeEnvelope).payload,
      ).toEqual([]);
    }
    await send(input, 'refinement_batch', {
      schema_version: 'ava-book-refinement-batch-1',
      source_sha256: fixture.job.source.sha256,
      tasks: [],
    });
    await send(input, 'artifacts', null);
  };
  const run = (semantic: SemanticValidator = () => Promise.resolve(true)) =>
    runReconstruction(
      {
        job: fixture.job,
        source: fixture.source,
        signal: jobController.signal,
        leaseRemainingMs: () => 5000,
      },
      { sandbox, dispatch, progress, stageArtifact: stage },
      semantic,
      fixture.job.worker_fingerprint,
    );
  return {
    fixture,
    jobController,
    session,
    sandbox,
    dispatch,
    progress,
    stage,
    send,
    prepare,
    run,
  };
}

const result = () => ({
  exitCode: 0,
  stdout: Buffer.alloc(0),
  faultAcknowledged: false,
  faultAcknowledgement: undefined,
});

it('runs one attempt sandbox and retains candidate fences, declared artifacts and publication ineligibility', async () => {
  const q = setup();
  q.sandbox.mockImplementation(async (input) => {
    await q.prepare(input);
    for (let i = 0; i < q.fixture.stream.length; i += 137)
      await input.onStdout!(q.fixture.stream.subarray(i, i + 137));
    q.session.abort(); // Natural transport completion closes its private session.
    return result();
  });
  const completed = await q.run();
  const envelope = JSON.parse(
    completed.completion.bytes.toString(),
  ) as WorkerResultV1;
  if (envelope.outcome.status !== 'candidate')
    throw new Error('Expected host control candidate');
  expect(q.sandbox).toHaveBeenCalledTimes(1);
  expect(q.dispatch).not.toHaveBeenCalled();
  expect(q.stage).toHaveBeenCalledTimes(q.fixture.artifacts.length);
  expect(completed.metadata).toEqual(q.fixture.book.metadata);
  expect(envelope.operation_id).toBe(q.fixture.job.operation_id);
  expect(envelope.attempt_fence).toBe(q.fixture.job.attempt_fence);
  expect(envelope.outcome.cli_exit_code).toBe(2);
  expect(envelope.outcome.publication_eligible).toBe(false);
  expect(Object.keys(completed.stagedByPath).sort()).toEqual(
    q.fixture.artifacts.map((a) => a.path).sort(),
  );
});

it('cannot return a candidate from an interrupted artifact stream', async () => {
  const q = setup();
  q.sandbox.mockImplementation(async (input) => {
    await q.prepare(input);
    await input.onStdout!(
      q.fixture.stream.subarray(
        0,
        q.fixture.stream.lastIndexOf('{"complete":true}'),
      ),
    );
    return result();
  });
  await expect(q.run()).rejects.toThrow('INVALID_RESULT');
  expect(q.progress.mock.calls.flat()).not.toContainEqual({
    stage: 'VALIDATION',
  });
});

it('rejects artifact hash tampering before staging the changed artifact', async () => {
  const q = setup();
  q.sandbox.mockImplementation(async (input) => {
    await q.prepare(input);
    const lines = q.fixture.stream.toString().split('\n');
    const header = JSON.parse(lines[0]) as { artifacts: { sha256: string }[] };
    header.artifacts[0].sha256 = 'f'.repeat(64);
    lines[0] = JSON.stringify(header);
    await input.onStdout!(Buffer.from(lines.join('\n')));
    return result();
  });
  await expect(q.run()).rejects.toThrow('INVALID_RESULT');
  expect(q.stage).not.toHaveBeenCalled();
});

it('fences asynchronous semantic validation and staging on session loss', async () => {
  const q = setup();
  q.sandbox.mockImplementation(async (input) => {
    await q.prepare(input);
    q.session.abort();
    await input.onStdout!(q.fixture.stream);
    return result();
  });
  await expect(q.run()).rejects.toBeInstanceOf(PdfRuntimeError);
  expect(q.stage).not.toHaveBeenCalled();
});

it('retains a typed source refusal without opening an artifact sink or marking validation complete', async () => {
  const q = setup();
  q.sandbox.mockImplementation(async (input) => {
    await q.send(input, 'refusal', {
      schema_version: 'ava-source-refusal-1',
      source_sha256: q.fixture.job.source.sha256,
      stage: 'extraction',
      findings: [
        {
          code: 'SOURCE_LANGUAGE_UNSUPPORTED',
          severity: 'blocking',
          page: 1,
          box: {
            coordinate_space: 'page_points_top_left',
            x0: 0,
            y0: 0,
            x1: 1,
            y1: 1,
          },
          region_box: {
            coordinate_space: 'page_points_top_left',
            x0: 0,
            y0: 0,
            x1: 1,
            y1: 1,
          },
          block_id: null,
          segment_id_sha256: null,
          task_id: null,
          render_sha256: null,
        },
      ],
    });
    return { ...result(), exitCode: 1 };
  });
  await expect(q.run()).rejects.toThrow('UNSUPPORTED_PDF');
  expect(q.stage).not.toHaveBeenCalled();
  expect(q.progress).not.toHaveBeenCalled();
});

it('rejects a completely matched historical report for the requested current feature policy', async () => {
  const q = setup(false);
  q.sandbox.mockImplementation(async (input) => {
    await q.prepare(input);
    await input.onStdout!(q.fixture.stream);
    return result();
  });
  await expect(q.run()).rejects.toThrow('INVALID_RESULT');
  expect(q.progress.mock.calls.flat()).not.toContainEqual({
    stage: 'VALIDATION',
  });
});

it('rechecks session authority after awaited semantic validation before staging', async () => {
  const q = setup();
  let entered!: () => void;
  let resolve!: (value: boolean) => void;
  const atSemantic = new Promise<void>((r) => {
    entered = r;
  });
  const semantic: SemanticValidator = (name) => {
    if (name !== 'ava-book-2') return Promise.resolve(true);
    entered();
    return new Promise<boolean>((r) => {
      resolve = r;
    });
  };
  q.sandbox.mockImplementation(async (input) => {
    await q.prepare(input);
    await input.onStdout!(q.fixture.stream);
    return result();
  });
  const pending = q.run(semantic);
  await atSemantic;
  q.session.abort();
  resolve(true);
  await expect(pending).rejects.toThrow('DISPATCH_NOT_AUTHORIZED');
  expect(q.stage).not.toHaveBeenCalled();
});
