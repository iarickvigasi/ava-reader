import { createHash } from 'node:crypto';
import { validateRecognitionTasks } from './validate-tasks';
import { prepared, response } from './test-fixture';
import type { SandboxInput } from '../runtime/container-arguments';
const input = (): SandboxInput => ({
  module: 'ava_pdf_epub.reconstruction_v2',
  source: Buffer.from('source'),
  deadlineMs: 1000,
  scratchBytes: 1024,
});
const result = (output: unknown, exitCode = 0) => ({
  exitCode,
  stdout: Buffer.from(JSON.stringify(output)),
  faultAcknowledged: false,
  faultAcknowledgement: undefined,
});

it('requires isolated semantic validation of the exact tasks and responses wire bytes', async () => {
  const sandbox = jest.fn((value: SandboxInput) =>
    Promise.resolve(
      result({
        schema_version: 'ava-recognition-tasks-checked-1',
        task_count: 1,
        request_sha256: createHash('sha256')
          .update(value.auxiliaryBytes!)
          .digest('hex'),
      }),
    ),
  );
  await validateRecognitionTasks(prepared.tasks, sandbox, input, [response]);
  const wire = JSON.parse(
    sandbox.mock.calls[0][0].auxiliaryBytes!.toString(),
  ) as { responses: unknown[] };
  expect(wire.responses).toEqual([response]);
});
it.each([
  { task_count: 2, request_sha256: 'a'.repeat(64) },
  { task_count: 1, request_sha256: 'b'.repeat(64) },
])('refuses a mismatching semantic receipt', async (change) => {
  const sandbox = jest
    .fn()
    .mockResolvedValue(
      result({ schema_version: 'ava-recognition-tasks-checked-1', ...change }),
    );
  await expect(
    validateRecognitionTasks(prepared.tasks, sandbox, input),
  ).rejects.toThrow('SOURCE_MISMATCH');
});
it('refuses a failed validator without any provider call', async () => {
  const sandbox = jest
    .fn()
    .mockResolvedValue(result({ error: 'invalid task' }, 1));
  await expect(
    validateRecognitionTasks(prepared.tasks, sandbox, input),
  ).rejects.toThrow('INVALID_RESULT');
});
