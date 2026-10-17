import { spawn } from 'node:child_process';
import { dockerExchange } from './docker-exchange';
import { dockerStream } from './docker-stream';
import { testConfig } from './config-fixture';
import { fakeDocker } from './exchange-process-fixture';
import { failureObservationFixture } from './failure-observation-fixture';
import { PdfRuntimeError } from './runtime-error';
jest.mock('node:child_process', () => ({ spawn: jest.fn() }));
afterEach(() => jest.clearAllMocks());

it.each(['valid', 'missing', 'malformed', 'foreign', 'completed', 'duplicate'])(
  'retains only validated failure observations on real exchange protocol rejection: %s',
  async (kind) => {
    const fake = fakeDocker(),
      { input, packet, line } = failureObservationFixture(kind === 'completed');
    jest.mocked(spawn).mockReturnValue(fake.child as never);
    const promise = dockerExchange(
      testConfig,
      'owned',
      input,
      1000,
      new AbortController().signal,
    );
    const result = promise.catch((error: unknown) => error);
    fake.child.stderr.write('private document bearer sk-secret\n');
    if (kind !== 'missing')
      fake.child.stderr.write(
        line(
          kind === 'malformed'
            ? { ...packet, privateText: 'private document' }
            : kind === 'foreign'
              ? {
                  ...packet,
                  binding: { ...packet.binding, attempt_id: 'foreign' },
                }
              : kind === 'completed'
                ? { ...packet, outcome: 'completed', failure_code: null }
                : packet,
        ),
      );
    if (kind === 'duplicate') fake.child.stderr.write(line());
    // A genuine invalid length prefix makes the protocol reject, not a mocked action.
    fake.child.stdout.write(Buffer.from([0, 0, 0, 1, 123]));
    const error = await result;
    expect(error).toBeInstanceOf(PdfRuntimeError);
    expect(error).toMatchObject({
      code: 'INVALID_RESULT',
      workerObservation:
        kind === 'valid' || kind === 'completed'
          ? { status: 'OBSERVED', packet }
          : {
              status: 'UNOBSERVED',
              reason:
                kind === 'missing'
                  ? 'NOT_EMITTED'
                  : kind === 'foreign'
                    ? 'BINDING_MISMATCH'
                    : 'MALFORMED',
            },
    });
    expect(JSON.stringify(error)).not.toMatch(
      /private document|sk-secret|privateText/,
    );
    expect(fake.child.kill).toHaveBeenCalledWith('SIGKILL');
  },
);

it.each([false, true])(
  'retains a valid packet when the bounded artifact sink rejects (worker completed=%s)',
  async (completed) => {
    const fake = fakeDocker(),
      { input, packet, line } = failureObservationFixture(completed);
    jest.mocked(spawn).mockReturnValue(fake.child as never);
    const result = (
      Reflect.apply(dockerStream, undefined, [
        testConfig,
        ['start'],
        1000,
        () => Promise.reject(new Error('private sink')),
        new AbortController().signal,
        true,
        input,
      ]) as ReturnType<typeof dockerStream>
    ).catch((error: unknown) => error);
    fake.child.stderr.write(line());
    fake.child.stdout.write(Buffer.from('artifact'));
    expect(await result).toMatchObject({
      code: 'INVALID_RESULT',
      workerObservation: { status: 'OBSERVED', packet },
    });
    expect(input.observationBinding).toBeDefined();
  },
);
