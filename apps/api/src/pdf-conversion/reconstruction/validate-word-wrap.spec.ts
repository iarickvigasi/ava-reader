import { validateWordWrap } from './validate-word-wrap';
import { wrapTask } from './word-wrap-fixture';
import { checksumBuffer } from '../../shared/blob-utils';
import type { SandboxInput } from '../runtime/container-arguments';
import { workerCommand } from '../runtime/worker-observation';
const input = (): SandboxInput => ({
  module: 'ava_pdf_epub.reconstruction_v2',
  source: Buffer.from('synthetic'),
  deadlineMs: 1000,
  scratchBytes: 1024,
});
const result = (value: unknown, exitCode = 0) => ({
  exitCode,
  stdout: Buffer.from(JSON.stringify(value)),
  faultAcknowledged: false,
  faultAcknowledgement: undefined,
});
const receipt = (v: SandboxInput) => ({
  schema_version: 'ava-word-wrap-validation-1',
  valid: true,
  request_sha256: checksumBuffer(v.auxiliaryBytes!),
});
it('binds exact private task bytes and preserves job/session cancellation before dispatch', async () => {
  const job = new AbortController(),
    session = new AbortController();
  const sandbox = jest.fn((v: SandboxInput) => {
    job.abort();
    expect(v.signal!.aborted).toBe(true);
    return Promise.resolve(result(receipt(v)));
  });
  await validateWordWrap(
    wrapTask,
    sandbox,
    () => ({ ...input(), signal: job.signal }),
    session.signal,
  );
  const request = sandbox.mock.calls[0][0];
  expect(JSON.parse(request.auxiliaryBytes!.toString())).toEqual({
    mode: 'validate_word_wrap',
    task: wrapTask,
    response: null,
  });
  expect(request.observationCommand).toEqual({
    command: 'validate_word_wrap',
    page_number: null,
  });
  expect(workerCommand.parse('validate_word_wrap')).toBe('validate_word_wrap');
  expect(request.deadlineMs).toBe(1000);
  expect(request.scratchBytes).toBe(1024);
});
it.each(['digest', 'schema', 'valid', 'extra'])(
  'refuses changed word parser receipt %s',
  async (change) => {
    const sandbox = jest.fn((v: SandboxInput) => {
      const r: Record<string, unknown> = receipt(v);
      if (change === 'digest') r.request_sha256 = 'f'.repeat(64);
      if (change === 'schema') r.schema_version = 'ava-refinement-validation-1';
      if (change === 'valid') r.valid = false;
      if (change === 'extra') r.task_id = wrapTask.task_id;
      return Promise.resolve(result(r));
    });
    await expect(
      validateWordWrap(wrapTask, sandbox, input, new AbortController().signal),
    ).rejects.toThrow('SOURCE_MISMATCH');
  },
);
it('refuses parser failure and oversized private task before another parser invocation', async () => {
  const sandbox = jest.fn(() =>
    Promise.resolve(result({ private: 'never expose this' }, 2)),
  );
  await expect(
    validateWordWrap(wrapTask, sandbox, input, new AbortController().signal),
  ).rejects.toThrow('INVALID_RESULT');
  const large = structuredClone(wrapTask);
  large.entries[0].source_pair = 'x'.repeat(8 * 1024 ** 2);
  await expect(
    validateWordWrap(large, sandbox, input, new AbortController().signal),
  ).rejects.toThrow('RESOURCE_LIMIT');
  expect(sandbox).toHaveBeenCalledTimes(1);
});
