import { spawn } from 'node:child_process';
import * as commands from './docker-command';
import { startContainer } from './start-container';
import { testConfig } from './config-fixture';
import { fakeDocker } from './exchange-process-fixture';
import { failureObservationFixture } from './failure-observation-fixture';
jest.mock('node:child_process', () => ({ spawn: jest.fn() }));
afterEach(() => jest.restoreAllMocks());

it('retains a valid bounded observation when buffered command output exceeds its limit', async () => {
  const { input, packet, line } = failureObservationFixture(),
    fake = fakeDocker();
  jest.mocked(spawn).mockReturnValue(fake.child as never);
  const pending = commands
    .dockerCommand(
      testConfig,
      ['start'],
      1000,
      1,
      undefined,
      undefined,
      true,
      input,
    )
    .catch((error: unknown) => error);
  fake.child.stderr.write('private source text\n');
  fake.child.stderr.write(line());
  fake.child.stdout.write(Buffer.from('too large'));
  expect(await pending).toMatchObject({
    code: 'RESOURCE_LIMIT',
    workerObservation: { status: 'OBSERVED', packet },
  });
  expect(JSON.stringify(await pending)).not.toContain('private source');
});

it.each<[number, boolean]>([
  [137, false],
  [152, false],
  [137, true],
  [152, true],
])(
  'preserves actual subprocess exit parity with resource code %s (worker completed=%s)',
  async (exitCode, completed) => {
    const { input, packet, line } = failureObservationFixture(completed);
    jest
      .spyOn(commands, 'dockerCommand')
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: Buffer.from('a'.repeat(64)),
        stderr: '',
      })
      .mockResolvedValueOnce({
        exitCode,
        stdout: Buffer.alloc(0),
        stderr: 'private stderr',
        observationStderr: line(),
      });
    await expect(
      startContainer(
        testConfig,
        { ...input, onExchange: undefined, onStdout: undefined },
        'owned',
        '/private',
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      code: 'RESOURCE_LIMIT',
      workerObservation: completed
        ? { status: 'UNOBSERVED', reason: 'MALFORMED' }
        : { status: 'OBSERVED', packet },
    });
  },
);
