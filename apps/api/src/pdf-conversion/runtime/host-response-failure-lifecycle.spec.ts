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
import { frame, envelope } from './exchange-test-fixture';
import { recognitionResponse } from '../reconstruction/recognition-response';
import { task } from '../reconstruction/test-fixture';
import { safeEventSchema } from '../../library/pdf-import/reports/event-contract';
import { PdfRuntimeError } from './runtime-error';

jest.mock('node:child_process', () => ({ spawn: jest.fn() }));
jest.mock('./private-inputs');
jest.mock('./start-container');
jest.mock('./docker-command');
afterEach(() => jest.resetAllMocks());

it.each([false, true])(
  'retains host finding through trusted exchange failure and cleanup (failed=%s)',
  async (cleanupFailed) => {
    const { observer, events, claim } = failureObserverFixture(),
      unit = 'host-invalid';
    const { input } = failureObservationFixture(),
      fake = fakeDocker();
    let original: Error | undefined;
    try {
      recognitionResponse(
        { ...task, source_sha256: claim.job.source.sha256 },
        '{"PRIVATE_BOOK":"sk-secret"',
      );
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      original = error;
    }
    if (!original) throw new Error('Expected original host refusal');
    const failure = original;
    input.onExchange = () => Promise.reject(failure);
    input.observationBinding = observer.binding(unit, input)!;
    jest.mocked(spawn).mockReturnValue(fake.child as never);
    jest.mocked(privateInputs).mockResolvedValue({
      directory: '/private/authored',
      cleanup: () => Promise.resolve(),
    });
    jest.mocked(dockerCommand).mockResolvedValue({
      exitCode: cleanupFailed ? 1 : 0,
      stdout: Buffer.alloc(0),
      stderr: 'private cleanup',
    });
    jest
      .mocked(startContainer)
      .mockImplementation((_config, snapshot, name, _directory, signal) =>
        dockerExchange(testConfig, name, snapshot, 1000, signal).then(
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
    fake.child.stdout.write(frame(envelope()));
    const error = await pending;
    expect(error).toBeInstanceOf(PdfRuntimeError);
    expect(error).toMatchObject({
      code: cleanupFailed ? 'WORKER_CRASH' : 'INVALID_RESULT',
    });
    if (!cleanupFailed) expect(error).toBe(original);
    const event = events.at(-1)!;
    expect(event.details).toMatchObject({
      failureCode: cleanupFailed ? 'WORKER_CRASH' : 'INVALID_RESULT',
      hostResponseValidation: {
        category: 'JSON_PARSE',
        sourceSha256: claim.job.source.sha256,
        pageNumber: 1,
      },
      workerObservation: { status: 'UNOBSERVED', reason: 'UNAVAILABLE' },
    });
    expect(safeEventSchema.parse(event)).toEqual(event);
    expect(JSON.stringify({ error, events })).not.toMatch(
      /PRIVATE_BOOK|sk-secret|private cleanup/,
    );
    expect(fake.child.kill).toHaveBeenCalled();
    expect(observer.finishCapture()).toMatchObject({
      sealed: true,
      throughOrdinal: 2,
    });
  },
);
