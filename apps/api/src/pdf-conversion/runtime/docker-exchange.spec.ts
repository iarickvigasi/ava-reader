import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { PassThrough } from 'node:stream';
import { dockerExchange } from './docker-exchange';
import { ExchangeFailure } from './exchange-failure';
import { testConfig } from './config-fixture';
import { envelope, frame, exchangeInput } from './exchange-test-fixture';
import { fakeDocker, turn } from './exchange-process-fixture';
import { artifactStream } from './artifact-stream';
import { encode } from './exchange-test-fixture';
import type { ExchangeEnvelope } from './exchange-protocol';
jest.mock('node:child_process', () => ({ spawn: jest.fn() }));
const spawnMock = jest.mocked(spawn);
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

it('accepts a next control after the worker reads its ACK while the write callback is pending', async () => {
  const fake = fakeDocker(),
    controller = new AbortController(),
    input = exchangeInput(),
    callbacks: number[] = [],
    artifacts: Buffer[] = [];
  let releaseFirstWrite: (() => void) | undefined,
    writeReleased = false,
    ackReceived = false,
    failure: string | undefined;
  fake.child.stdin = new PassThrough({
    transform(chunk: Buffer, _encoding, done) {
      // Readable bytes can reach the worker before the local Writable callback.
      this.push(chunk);
      if (!releaseFirstWrite) {
        releaseFirstWrite = () => {
          writeReleased = true;
          done();
        };
      } else done();
    },
  });
  fake.child.stdin.on('data', (bytes: Buffer) => {
    expect(bytes.length).toBe(4 + bytes.readUInt32BE());
    const ack = JSON.parse(bytes.subarray(4).toString()) as ExchangeEnvelope;
    expect(ack.payload).toEqual([]);
    if (ack.sequence === 1) {
      ackReceived = true;
      expect(writeReleased).toBe(false);
      // This is a compliant response to received ACK bytes, not an unsolicited
      // control during the host callback or a coalesced worker request.
      fake.child.stdout.write(frame(envelope(2, 'refinement_batch')));
    }
  });
  const respond = input.onExchange!;
  input.onExchange = (bytes, signal) => {
    callbacks.push((JSON.parse(bytes.toString()) as ExchangeEnvelope).sequence);
    return respond(bytes, signal);
  };
  input.onStdout = (bytes) => {
    artifacts.push(bytes);
    return Promise.resolve();
  };
  spawnMock.mockReturnValue(fake.child as never);
  const result = dockerExchange(
    testConfig,
    'owned',
    input,
    1000,
    controller.signal,
  );
  const outcome = result.then(
    (value) => value,
    (error: unknown) => {
      failure = error instanceof Error ? error.message : 'UNTYPED_REJECTION';
      return error;
    },
  );
  try {
    fake.child.stdout.write(frame(envelope()));
    await turn();
    expect(ackReceived).toBe(true);
    expect(writeReleased).toBe(false);
    expect(callbacks).toEqual([1]);
    expect(failure).toBeUndefined();
    releaseFirstWrite!();
    await turn();
    expect(callbacks).toEqual([1, 2]);
    expect(fake.child.stdin.writableEnded).toBe(true);
    fake.child.stdout.write(
      Buffer.concat([
        frame(envelope(3, 'artifacts')),
        Buffer.from('{"complete":true}\n'),
      ]),
    );
    await turn();
    fake.child.stdout.end();
    await turn();
    fake.child.emit('close', 0);
    await expect(outcome).resolves.toMatchObject({ exitCode: 0 });
    expect(Buffer.concat(artifacts)).toEqual(
      Buffer.from('{"complete":true}\n'),
    );
    expect(fake.child.kill).not.toHaveBeenCalled();
  } finally {
    if (!writeReleased) releaseFirstWrite?.();
    controller.abort();
    await outcome;
    fake.child.stdin.destroy();
    fake.child.stdout.destroy();
    fake.child.stderr.destroy();
  }
});

it('keeps artifact input paused during deferred canonical validation after a split marker', async () => {
  const fake = fakeDocker();
  spawnMock.mockReturnValue(fake.child as never);
  const input = exchangeInput(),
    data = Buffer.from('authored canonical bytes'),
    descriptors = [
      'canonical.json',
      'book.epub',
      'reconstruction-report.json',
    ].map((path) => ({
      path,
      sha256: createHash('sha256').update(data).digest('hex'),
      byte_length: data.length,
    })),
    staged: string[] = [];
  let acceptCanonical!: () => void,
    validationStarted = false,
    artifactSignal: AbortSignal | undefined;
  const acknowledged = input.onExchange!;
  input.onExchange = (bytes, signal) => {
    artifactSignal = signal;
    return acknowledged(bytes, signal);
  };
  const sink = artifactStream(async (descriptor) => {
    if (descriptor.path === 'canonical.json') {
      validationStarted = true;
      await new Promise<void>((resolve) => {
        acceptCanonical = resolve;
      });
    }
    expect(artifactSignal?.aborted).toBe(false);
    staged.push(descriptor.path);
  });
  input.onStdout = (bytes) => sink.write(bytes);
  const result = dockerExchange(
    testConfig,
    'owned',
    input,
    1000,
    new AbortController().signal,
  );
  // Observe failure immediately, so a broken implementation leaves no unhandled rejection.
  const outcome = result.then(
    (value) => value,
    (error: unknown) => error,
  );
  fake.child.stdout.write(frame(envelope()));
  await turn();
  fake.child.stdout.write(frame(envelope(2, 'refinement_batch')));
  await turn();
  const marker = frame(envelope(3, 'artifacts')),
    line = (value: unknown) => Buffer.from(JSON.stringify(value) + '\n'),
    chunk = (path: string) =>
      line({ path, offset: 0, base64: data.toString('base64') });
  // Both reads are legal pipe fragmentation. The first read's completion must
  // not resume stdout after the newer read has paused it for async validation.
  fake.child.stdout.write(marker.subarray(0, 2));
  fake.child.stdout.write(
    Buffer.concat([
      marker.subarray(2),
      line({
        schema_version: 'ava-reconstruct-stream-1',
        report: {},
        artifacts: descriptors,
      }),
      chunk('canonical.json'),
    ]),
  );
  fake.child.stdout.write(
    Buffer.concat([
      chunk('book.epub'),
      chunk('reconstruction-report.json'),
      line({ complete: true }),
    ]),
  );
  await turn();
  expect(validationStarted).toBe(true);
  expect(fake.child.stdout.isPaused()).toBe(true);
  expect(artifactSignal?.aborted).toBe(false);
  expect(staged).toEqual([]);
  acceptCanonical();
  await turn();
  fake.child.stdout.end();
  await turn();
  fake.child.emit('close', 0);
  await expect(outcome).resolves.toMatchObject({ exitCode: 0 });
  expect(sink.finish().artifacts).toEqual(descriptors);
  expect(staged).toEqual(descriptors.map(({ path }) => path));
  expect(fake.child.kill).not.toHaveBeenCalled();
});

it.each(['complete', 'abort'] as const)(
  'serializes exit-time stdout resume during deferred artifact validation: %s',
  async (completion) => {
    const fake = fakeDocker();
    spawnMock.mockReturnValue(fake.child as never);
    const input = exchangeInput(),
      controller = new AbortController(),
      data = Buffer.from('authored artifact bytes'),
      descriptors = [
        'canonical.json',
        'book.epub',
        'reconstruction-report.json',
      ].map((path) => ({
        path,
        sha256: createHash('sha256').update(data).digest('hex'),
        byte_length: data.length,
      })),
      staged: string[] = [];
    let releaseCanonical = () => {},
      releaseBook = () => {},
      canonicalStarted = false,
      bookStarted = false,
      activeWrites = 0,
      maxActiveWrites = 0,
      settled = false,
      artifactSignal: AbortSignal | undefined;
    const acknowledged = input.onExchange!;
    input.onExchange = (bytes, signal) => {
      artifactSignal = signal;
      return acknowledged(bytes, signal);
    };
    const sink = artifactStream(async (descriptor) => {
      if (descriptor.path === 'canonical.json') {
        canonicalStarted = true;
        await new Promise<void>((resolve) => {
          releaseCanonical = resolve;
        });
      } else if (descriptor.path === 'book.epub') {
        bookStarted = true;
        await new Promise<void>((resolve) => {
          releaseBook = resolve;
        });
      }
      if (!artifactSignal?.aborted) staged.push(descriptor.path);
    });
    input.onStdout = async (bytes) => {
      activeWrites++;
      maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
      try {
        await sink.write(bytes);
      } finally {
        activeWrites--;
      }
    };
    const outcome = dockerExchange(
      testConfig,
      'owned',
      input,
      1000,
      controller.signal,
    ).then(
      (value) => {
        settled = true;
        return value;
      },
      (error: unknown) => {
        settled = true;
        return error;
      },
    );
    try {
      fake.child.stdout.write(frame(envelope()));
      await turn();
      fake.child.stdout.write(frame(envelope(2, 'refinement_batch')));
      await turn();
      const line = (value: unknown) =>
          Buffer.from(JSON.stringify(value) + '\n'),
        chunk = (path: string) =>
          line({ path, offset: 0, base64: data.toString('base64') });
      fake.child.stdout.write(
        Buffer.concat([
          frame(envelope(3, 'artifacts')),
          line({
            schema_version: 'ava-reconstruct-stream-1',
            report: {},
            artifacts: descriptors,
          }),
          chunk('canonical.json'),
        ]),
      );
      await turn();
      expect(canonicalStarted).toBe(true);
      expect(fake.child.stdout.isPaused()).toBe(true);
      fake.child.stdout.end(
        Buffer.concat([
          chunk('book.epub'),
          chunk('reconstruction-report.json'),
          line({ complete: true }),
        ]),
      );
      // Node's child exit flushStdio resumes readable pipes even when the
      // application paused them while awaiting an asynchronous artifact sink.
      fake.child.stdout.resume();
      await turn();
      expect(fake.child.stdout.readableEnded).toBe(true);
      fake.child.emit('close', 0);
      await turn();
      expect(maxActiveWrites).toBe(1);
      expect(settled).toBe(false);
      expect(bookStarted).toBe(false);
      expect(staged).toEqual([]);
      if (completion === 'abort') {
        controller.abort();
        await expect(outcome).resolves.toThrow('DISPATCH_NOT_AUTHORIZED');
        expect(artifactSignal?.aborted).toBe(true);
        releaseCanonical();
        await turn();
        expect(bookStarted).toBe(false);
        expect(staged).toEqual([]);
        expect(activeWrites).toBe(0);
        expect(fake.child.kill).toHaveBeenCalledWith('SIGKILL');
      } else {
        releaseCanonical();
        await turn();
        expect(bookStarted).toBe(true);
        expect(settled).toBe(false);
        expect(staged).toEqual(['canonical.json']);
        releaseBook();
        await expect(outcome).resolves.toMatchObject({ exitCode: 0 });
        expect(activeWrites).toBe(0);
        expect(sink.finish().artifacts).toEqual(descriptors);
        expect(staged).toEqual(descriptors.map(({ path }) => path));
        expect(fake.child.kill).not.toHaveBeenCalled();
      }
    } finally {
      controller.abort();
      releaseCanonical();
      releaseBook();
      await outcome;
      await turn();
      fake.child.stdout.destroy();
      fake.child.stderr.destroy();
    }
  },
);

it('does not start its owned attach process after prior cancellation', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    dockerExchange(
      testConfig,
      'owned',
      exchangeInput(),
      1000,
      controller.signal,
    ),
  ).rejects.toThrow('DISPATCH_NOT_AUTHORIZED');
  expect(spawnMock).not.toHaveBeenCalled();
});

it('fails promptly when stdout is destroyed after the artifacts marker without reaching EOF', async () => {
  const fake = fakeDocker();
  spawnMock.mockReturnValue(fake.child as never);
  const result = dockerExchange(
    testConfig,
    'owned',
    exchangeInput(),
    1000,
    new AbortController().signal,
  );
  const rejected = expect(result).rejects.toThrow('WORKER_CRASH');
  for (const value of [
    envelope(),
    envelope(2, 'refinement_batch'),
    envelope(3, 'artifacts'),
  ]) {
    fake.child.stdout.write(frame(value));
    await turn();
  }
  expect(fake.child.stdout.readableEnded).toBe(false);
  fake.child.stdout.destroy();
  await rejected;
  expect(fake.child.kill).toHaveBeenCalledWith('SIGKILL');
});

it.each(['recognition', 'refinement'] as const)(
  'does not dispatch remaining %s tasks after the worker rejects its first single reply',
  async (kind) => {
    const fake = fakeDocker();
    spawnMock.mockReturnValue(fake.child as never);
    const input = exchangeInput(),
      dispatched: string[] = [];
    input.onExchange = (bytes) => {
      const request = JSON.parse(bytes.toString()) as ExchangeEnvelope;
      if (request.kind === 'refusal') return Promise.resolve(Buffer.alloc(0));
      if (request.kind === 'recognition' || request.kind === 'refinement') {
        dispatched.push((request.payload as { task_id: string }).task_id);
        // Deliberately invalid semantic response: the worker rejects it before its next task control.
        return Promise.resolve(
          encode({ ...request, payload: [{ invalid: true }] }),
        );
      }
      return Promise.resolve(encode({ ...request, payload: [] }));
    };
    const result = dockerExchange(
      testConfig,
      'owned',
      input,
      1000,
      new AbortController().signal,
    );
    const tasks = Array.from(
      { length: kind === 'recognition' ? 50 : 32 },
      (_, i) => ({ task_id: `task-${i}` }),
    );
    let seq = 1;
    fake.child.stdout.write(
      frame({
        ...envelope(seq),
        payload: { tasks: kind === 'recognition' ? tasks : [] },
      }),
    );
    await turn();
    if (kind === 'refinement') {
      fake.child.stdout.write(
        frame({ ...envelope(++seq, 'refinement_batch'), payload: { tasks } }),
      );
      await turn();
    }
    expect(dispatched).toEqual([]);
    fake.child.stdout.write(
      frame({ ...envelope(++seq, kind), payload: tasks[0] }),
    );
    await turn();
    expect(dispatched).toEqual(['task-0']);
    const sent = JSON.parse(
      fake.writes.at(-1)!.subarray(4).toString(),
    ) as ExchangeEnvelope;
    expect(sent.payload).toEqual([{ invalid: true }]);
    fake.child.stdout.write(frame(envelope(++seq, 'refusal')));
    await turn();
    fake.child.emit('close', 1);
    await expect(result).resolves.toMatchObject({ exitCode: 1 });
    expect(dispatched).toEqual(['task-0']);
  },
);

it('keeps stdin open through batch ACK and every intermediate task reply', async () => {
  const fake = fakeDocker(true);
  spawnMock.mockReturnValue(fake.child as never);
  const result = dockerExchange(
    testConfig,
    'owned',
    exchangeInput(),
    1000,
    new AbortController().signal,
  );
  const controls = [
    envelope(),
    {
      ...envelope(2, 'refinement_batch'),
      payload: { tasks: [{ task_id: 'first' }, { task_id: 'second' }] },
    },
    { ...envelope(3, 'refinement'), payload: { task_id: 'first' } },
    { ...envelope(4, 'refinement'), payload: { task_id: 'second' } },
  ];
  for (let i = 0; i < controls.length; i++) {
    fake.child.stdout.write(frame(controls[i]));
    await turn();
    expect(fake.child.stdin.writableEnded).toBe(false);
    fake.release();
    await turn();
    expect(fake.child.stdin.writableEnded).toBe(i === controls.length - 1);
  }
  fake.child.stdout.write(frame(envelope(5, 'artifacts')));
  await turn();
  fake.child.emit('close', 0);
  await expect(result).resolves.toMatchObject({ exitCode: 0 });
});

it('rejects another framed control after the artifact marker through the stock artifact sink', async () => {
  const fake = fakeDocker();
  spawnMock.mockReturnValue(fake.child as never);
  const input = exchangeInput(),
    sink = artifactStream(() => Promise.resolve());
  input.onStdout = (bytes) => sink.write(bytes);
  const result = dockerExchange(
    testConfig,
    'owned',
    input,
    1000,
    new AbortController().signal,
  );
  const rejected = expect(result).rejects.toThrow('INVALID_RESULT');
  fake.child.stdout.write(frame(envelope()));
  await turn();
  fake.child.stdout.write(frame(envelope(2, 'refinement_batch')));
  await turn();
  fake.child.stdout.write(
    Buffer.concat([
      frame(envelope(3, 'artifacts')),
      frame(envelope(4)),
      Buffer.from('\n'),
    ]),
  );
  await rejected;
});

it('allows a valid refusal to finish its failure observation and exit1 without killing it', async () => {
  const fake = fakeDocker();
  spawnMock.mockReturnValue(fake.child as never);
  const input = exchangeInput();
  input.onExchange = () => Promise.resolve(Buffer.alloc(0));
  const result = dockerExchange(
    testConfig,
    'owned',
    input,
    1000,
    new AbortController().signal,
  );
  fake.child.stdout.write(frame(envelope(1, 'refusal')));
  await turn();
  expect(fake.child.stdin.writableEnded).toBe(true);
  expect(fake.writes).toHaveLength(0);
  fake.child.stderr.write('retained failed-command observation\n');
  fake.child.emit('close', 1);
  await expect(result).resolves.toMatchObject({
    exitCode: 1,
    stderr: 'retained failed-command observation\n',
  });
  expect(fake.child.kill).not.toHaveBeenCalled();
});

it('retains a valid refusal when worker stdin closes during host diagnostic validation', async () => {
  const fake = fakeDocker();
  spawnMock.mockReturnValue(fake.child as never);
  const input = exchangeInput();
  let acknowledge!: (bytes: Buffer) => void;
  input.onExchange = () =>
    new Promise((resolve) => {
      acknowledge = resolve;
    });
  const result = dockerExchange(
    testConfig,
    'owned',
    input,
    1000,
    new AbortController().signal,
  );
  fake.child.stdout.write(frame(envelope(1, 'refusal')));
  fake.child.stdin.destroy();
  await turn();
  fake.child.emit('close', 1);
  acknowledge(Buffer.alloc(0));
  await expect(result).resolves.toMatchObject({ exitCode: 1 });
  expect(fake.child.kill).not.toHaveBeenCalled();
  expect(fake.writes).toHaveLength(0);
});

it.each(['exit0', 'trailing'])(
  'rejects refusal %s after the empty host acknowledgement',
  async (mode) => {
    const fake = fakeDocker();
    spawnMock.mockReturnValue(fake.child as never);
    const input = exchangeInput();
    input.onExchange = () => Promise.resolve(Buffer.alloc(0));
    const result = dockerExchange(
      testConfig,
      'owned',
      input,
      1000,
      new AbortController().signal,
    );
    const rejected = expect(result).rejects.toThrow('INVALID_RESULT');
    fake.child.stdout.write(frame(envelope(1, 'refusal')));
    await turn();
    if (mode === 'trailing') fake.child.stdout.write(Buffer.from('extra'));
    else fake.child.emit('close', 0);
    await rejected;
  },
);

it('awaits reply backpressure, seals stdin after refinement, then streams artifacts unchanged', async () => {
  const fake = fakeDocker(true);
  spawnMock.mockReturnValue(fake.child as never);
  const input = exchangeInput(),
    artifacts: Buffer[] = [];
  input.onStdout = (bytes) => {
    artifacts.push(bytes);
    return Promise.resolve();
  };
  const result = dockerExchange(
    testConfig,
    'fixed-owned',
    input,
    1000,
    new AbortController().signal,
  );
  fake.child.stdout.write(frame(envelope()));
  await turn();
  expect(fake.writes).toHaveLength(1);
  expect(fake.child.stdin.writableEnded).toBe(false);
  fake.release();
  await turn();
  fake.child.stdout.write(frame(envelope(2, 'refinement_batch')));
  await turn();
  expect(fake.child.stdin.writableEnded).toBe(false);
  fake.release();
  await turn();
  expect(fake.child.stdin.writableEnded).toBe(true);
  fake.child.stdout.write(
    Buffer.concat([
      frame(envelope(3, 'artifacts')),
      Buffer.from('{"complete":true}\n'),
    ]),
  );
  await turn();
  fake.child.stdout.end();
  await turn();
  expect(fake.child.stdout.readableEnded).toBe(true);
  fake.child.emit('close', 0);
  await expect(result).resolves.toMatchObject({ exitCode: 0 });
  expect(Buffer.concat(artifacts)).toEqual(Buffer.from('{"complete":true}\n'));
  expect(fake.child.kill).not.toHaveBeenCalled();
  expect(spawnMock.mock.calls[0][1]).toEqual([
    '--host',
    testConfig.dockerHost,
    'start',
    '--attach',
    '--interactive',
    'fixed-owned',
  ]);
});

it('aborts the callback and returns promptly without sending a late reply', async () => {
  const fake = fakeDocker();
  spawnMock.mockReturnValue(fake.child as never);
  const input = exchangeInput(),
    controller = new AbortController();
  let reply!: () => void, callbackSignal: AbortSignal | undefined;
  const respond = input.onExchange!;
  input.onExchange = (bytes, signal) => {
    callbackSignal = signal;
    return new Promise((resolve) => {
      reply = () => {
        void respond(bytes, signal).then(resolve);
      };
    });
  };
  const result = dockerExchange(
    testConfig,
    'owned',
    input,
    1000,
    controller.signal,
  );
  const rejected = expect(result).rejects.toThrow('DISPATCH_NOT_AUTHORIZED');
  fake.child.stdout.write(frame(envelope()));
  await turn();
  controller.abort();
  await rejected;
  expect(callbackSignal?.aborted).toBe(true);
  reply();
  await turn();
  expect(fake.writes).toHaveLength(0);
  expect(fake.child.kill).toHaveBeenCalledWith('SIGKILL');
});

it('preserves a host WAIT exception without treating it as worker success', async () => {
  const fake = fakeDocker();
  spawnMock.mockReturnValue(fake.child as never);
  const input = exchangeInput(),
    wait = new Error('PDF_PROVIDER_OUTCOME_UNCERTAIN');
  input.onExchange = () => Promise.reject(wait);
  const result = dockerExchange(
    testConfig,
    'owned',
    input,
    1000,
    new AbortController().signal,
  );
  fake.child.stdout.write(frame(envelope()));
  await expect(result).rejects.toEqual(new ExchangeFailure(wait));
  expect(fake.writes).toHaveLength(0);
});

it('retains a delayed typed refusal even if the worker already exits', async () => {
  const fake = fakeDocker();
  spawnMock.mockReturnValue(fake.child as never);
  const input = exchangeInput(),
    refused = new Error('SOURCE_REFUSAL');
  let reject!: (error: Error) => void;
  input.onExchange = () =>
    new Promise((_resolve, fail) => {
      reject = fail;
    });
  const result = dockerExchange(
    testConfig,
    'owned',
    input,
    1000,
    new AbortController().signal,
  );
  fake.child.stdout.write(frame(envelope(1, 'refusal')));
  fake.child.emit('close', 1);
  reject(refused);
  await expect(result).rejects.toEqual(new ExchangeFailure(refused));
});

it('fences callback and write on the absolute deadline', async () => {
  jest.useFakeTimers();
  const fake = fakeDocker();
  spawnMock.mockReturnValue(fake.child as never);
  const input = exchangeInput();
  let callbackSignal: AbortSignal | undefined;
  input.onExchange = (_bytes, signal) => {
    callbackSignal = signal;
    return new Promise(() => {});
  };
  const result = dockerExchange(
    testConfig,
    'owned',
    input,
    10,
    new AbortController().signal,
  );
  const rejected = expect(result).rejects.toThrow('EXECUTION_TIMEOUT');
  fake.child.stdout.write(frame(envelope()));
  await jest.advanceTimersByTimeAsync(10);
  await rejected;
  expect(callbackSignal?.aborted).toBe(true);
  expect(fake.writes).toHaveLength(0);
});

it.each([
  'early-close',
  'epipe',
  'stdout-error',
  'stderr-error',
  'stdout-close',
  'unsolicited',
  'truncated',
])('refuses %s while bounding and terminating its child', async (failure) => {
  const fake = fakeDocker();
  spawnMock.mockReturnValue(fake.child as never);
  const input = exchangeInput();
  let activeSignal: AbortSignal | undefined;
  input.onExchange = (_bytes, signal) => {
    activeSignal = signal;
    return new Promise(() => {});
  };
  const result = dockerExchange(
    testConfig,
    'owned',
    input,
    1000,
    new AbortController().signal,
  );
  const rejected = expect(result).rejects.toThrow(
    failure === 'unsolicited' || failure === 'truncated'
      ? undefined
      : 'WORKER_CRASH',
  );
  if (failure === 'truncated') {
    fake.child.stdout.write(Buffer.from([0, 0]));
    fake.child.emit('close', 0);
  } else {
    fake.child.stdout.write(frame(envelope()));
    if (failure === 'early-close') fake.child.emit('close', 0);
    if (failure === 'epipe') fake.child.stdin.emit('error', new Error('EPIPE'));
    if (failure === 'stdout-error')
      fake.child.stdout.emit('error', new Error('EIO'));
    if (failure === 'stderr-error')
      fake.child.stderr.emit('error', new Error('EIO'));
    if (failure === 'stdout-close') fake.child.stdout.destroy();
    if (failure === 'unsolicited') fake.child.stdout.write(frame(envelope(2)));
  }
  await rejected;
  if (failure !== 'truncated') expect(activeSignal?.aborted).toBe(true);
  expect(fake.child.kill).toHaveBeenCalledWith('SIGKILL');
});
