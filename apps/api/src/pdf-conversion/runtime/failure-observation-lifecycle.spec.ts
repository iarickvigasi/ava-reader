import { spawn } from 'node:child_process';
import { runSandbox } from './run-sandbox';
import { privateInputs } from './private-inputs';
import { startContainer } from './start-container';
import { dockerCommand } from './docker-command';
import { dockerExchange } from './docker-exchange';
import { testConfig } from './config-fixture';
import { fakeDocker } from './exchange-process-fixture';
import {
  failureObservationFixture,
  failureObserverFixture,
} from './failure-observation-fixture';
import { PdfRuntimeError } from './runtime-error';
jest.mock('node:child_process', () => ({ spawn: jest.fn() }));
jest.mock('./private-inputs');
jest.mock('./start-container');
jest.mock('./docker-command');
afterEach(() => jest.resetAllMocks());

it.each([
  [false, false],
  [true, false],
  [false, true],
])(
  'preserves the validated command packet through cleanup (failure=%s, worker completed=%s) into its failed coordinator journal event',
  async (cleanupFailed, completed) => {
    const order: string[] = [],
      { observer, events, claim } = failureObserverFixture(),
      unit = 'unit-failed';
    const { input, packet, line } = failureObservationFixture(completed),
      fake = fakeDocker();
    packet.binding = observer.binding(unit, input)!;
    packet.inventory.observed_profile_id = claim.job.profile_id;
    input.observationBinding = { ...packet.binding };
    jest.mocked(spawn).mockReturnValue(fake.child as never);
    jest.mocked(privateInputs).mockResolvedValue({
      directory: '/private/authored',
      cleanup: () => {
        order.push('inputs');
        return Promise.resolve();
      },
    });
    jest.mocked(dockerCommand).mockImplementation(() => {
      order.push('container');
      return Promise.resolve({
        exitCode: cleanupFailed ? 1 : 0,
        stdout: Buffer.alloc(0),
        stderr: 'private cleanup text',
      });
    });
    jest
      .mocked(startContainer)
      .mockImplementation((_config, snapshot, name, _directory, actualSignal) =>
        dockerExchange(testConfig, name, snapshot, 1000, actualSignal).then(
          ({ exitCode, stdout }) => ({
            exitCode,
            stdout,
            faultAcknowledged: false,
            faultAcknowledgement: undefined,
          }),
        ),
      );
    const pending = observer
      .track('WORKER_COMMAND', unit, () => runSandbox(input, testConfig))
      .catch((error: unknown) => error);
    await new Promise<void>((resolve) => setImmediate(resolve));
    fake.child.stderr.write('private PDF text bearer sk-secret\n');
    fake.child.stderr.write(line());
    fake.child.stdout.write(Buffer.from([0, 0, 0, 1, 123]));
    const error = await pending;
    expect(error).toBeInstanceOf(PdfRuntimeError);
    expect(error).toMatchObject({
      code: 'INVALID_RESULT',
      cleanupFailed,
      workerObservation: { status: 'OBSERVED', packet },
    });
    expect(order).toEqual(['container', 'inputs']);
    expect(events.at(-1)).toMatchObject({
      kind: 'STAGE_ENDED',
      stage: 'WORKER_COMMAND',
      details: {
        outcome: 'FAILED',
        failureCode: 'INVALID_RESULT',
        workerObservation: { status: 'OBSERVED', packet },
      },
    });
    expect(JSON.stringify({ error, events })).not.toMatch(
      /private PDF|private cleanup|sk-secret|bearer/,
    );
    expect(observer.finishCapture()).toMatchObject({
      sealed: true,
      throughOrdinal: 2,
    });
  },
);
