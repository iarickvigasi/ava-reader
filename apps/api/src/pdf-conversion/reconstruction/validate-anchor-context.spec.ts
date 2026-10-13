import { validateAnchorContext } from './validate-anchor-context';
import { anchorParent, anchorTask } from './anchor-context-fixture';
import { contextSha } from './anchor-context-binding';
import type { SandboxInput } from '../runtime/container-arguments';
import { workerCommand } from '../runtime/worker-observation';
const input = (): SandboxInput => ({
  module: 'ava_pdf_epub.reconstruction_v2',
  source: Buffer.from('authored source'),
  deadlineMs: 1000,
  scratchBytes: 1024,
});
const result = (value: unknown, exitCode = 0) => ({
  exitCode,
  stdout: Buffer.from(JSON.stringify(value)),
  faultAcknowledged: false,
  faultAcknowledgement: undefined,
});

it('checks the exact original task and correction through the pinned parser before authorizing repair', async () => {
  const controller = new AbortController();
  const sandbox = jest.fn((value: SandboxInput) =>
    Promise.resolve(
      result({
        schema_version: 'ava-anchor-context-checked-1',
        task_id: anchorTask.task_id,
        request_sha256: contextSha(value.auxiliaryBytes!.toString()),
      }),
    ),
  );
  await validateAnchorContext(
    anchorTask,
    anchorParent,
    sandbox,
    input,
    controller.signal,
  );
  const invocation = sandbox.mock.calls[0][0];
  expect(JSON.parse(invocation.auxiliaryBytes!.toString())).toEqual({
    mode: 'validate_anchor_context',
    task: anchorParent,
    correction: anchorTask,
  });
  expect(invocation.observationCommand).toEqual({
    command: 'validate_anchor_context',
    page_number: null,
  });
  expect(workerCommand.parse('validate_anchor_context')).toBe(
    'validate_anchor_context',
  );
  expect(invocation.deadlineMs).toBe(1000);
  expect(invocation.scratchBytes).toBe(1024);
  expect(invocation.signal).toBe(controller.signal);
});

it.each(['digest', 'task', 'schema', 'extra'])(
  'refuses a changed %s parser receipt',
  async (kind) => {
    const sandbox = jest.fn((value: SandboxInput) => {
      const receipt: Record<string, unknown> = {
        schema_version: 'ava-anchor-context-checked-1',
        task_id: anchorTask.task_id,
        request_sha256: contextSha(value.auxiliaryBytes!.toString()),
      };
      if (kind === 'digest') receipt.request_sha256 = 'f'.repeat(64);
      if (kind === 'task') receipt.task_id = 'foreign-task';
      if (kind === 'schema') receipt.schema_version = 'other-schema';
      if (kind === 'extra') receipt.private = 'private-document-auth-control';
      return Promise.resolve(result(receipt));
    });
    await expect(
      validateAnchorContext(
        anchorTask,
        anchorParent,
        sandbox,
        input,
        new AbortController().signal,
      ),
    ).rejects.toThrow('SOURCE_MISMATCH');
  },
);

it('refuses parser failure/oversized input without leaking private stdout or starting a second parser', async () => {
  const sandbox = jest
    .fn()
    .mockResolvedValue(
      result({ detail: 'private bearer sk-secret document' }, 1),
    );
  try {
    await validateAnchorContext(
      anchorTask,
      anchorParent,
      sandbox,
      input,
      new AbortController().signal,
    );
    throw new Error('accepted');
  } catch (error) {
    expect((error as Error).message).toBe('INVALID_RESULT');
    expect(JSON.stringify(error)).not.toMatch(/private|bearer|sk-secret/);
  }
  const oversized = {
    ...anchorTask,
    original_response_json: 'x'.repeat(24 * 1024 ** 2),
  };
  await expect(
    validateAnchorContext(
      oversized,
      anchorParent,
      sandbox,
      input,
      new AbortController().signal,
    ),
  ).rejects.toThrow('RESOURCE_LIMIT');
  expect(sandbox).toHaveBeenCalledTimes(1);
});

it('keeps job and streaming-session cancellation in the parser signal', async () => {
  const job = new AbortController(),
    session = new AbortController();
  const sandbox = jest.fn((value: SandboxInput) => {
    job.abort();
    expect(value.signal!.aborted).toBe(true);
    return Promise.resolve(
      result({
        schema_version: 'ava-anchor-context-checked-1',
        task_id: anchorTask.task_id,
        request_sha256: contextSha(value.auxiliaryBytes!.toString()),
      }),
    );
  });
  await validateAnchorContext(
    anchorTask,
    anchorParent,
    sandbox,
    () => ({ ...input(), signal: job.signal }),
    session.signal,
  );
});
