import { createHash } from 'node:crypto';
import { preparePages } from './prepare-pages';
import type { CoordinatorDependencies } from './coordinator-types';
import type { SandboxInput } from '../runtime/container-arguments';
import { prepared, response, task } from './test-fixture';
function setup(
  packet: typeof prepared & {
    profile_id?: 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
  } = prepared,
) {
  const deps = {
    sandbox: jest.fn().mockImplementation((input: SandboxInput) => {
      const auxiliary = JSON.parse(input.auxiliaryBytes!.toString()) as {
        mode: string;
        tasks: unknown[];
      };
      const output =
        auxiliary.mode === 'validate_tasks'
          ? {
              schema_version: 'ava-recognition-tasks-checked-1',
              request_sha256: createHash('sha256')
                .update(input.auxiliaryBytes!)
                .digest('hex'),
              task_count: auxiliary.tasks.length,
            }
          : packet;
      return Promise.resolve({
        exitCode: 0,
        stdout: Buffer.from(JSON.stringify(output)),
        faultAcknowledged: false,
      });
    }),
    dispatch: jest.fn().mockResolvedValue({ output: JSON.stringify(response) }),
    progress: jest.fn().mockResolvedValue(undefined),
    stageArtifact: jest.fn().mockResolvedValue('staged'),
  };
  const sandboxInput = (): SandboxInput => ({
    module: 'ava_pdf_epub.reconstruction_v2',
    source: Buffer.from('synthetic'),
    deadlineMs: 1000,
    scratchBytes: 1000,
  });
  return {
    deps,
    input: {
      deps: deps as CoordinatorDependencies,
      sandboxInput,
      sourceSha256: task.source_sha256,
      pageLimit: 1,
      providerMode: 'stub',
    },
  };
}
it('native pages spend no provider tokens and report completed page work', async () => {
  const { input, deps } = setup({
    ...prepared,
    native_segment_count: 2,
    tasks: [],
  });
  const result = await preparePages({ ...input, providerMode: 'native' });
  expect(result).toEqual({ responses: [], pageCount: 1, taskCount: 0 });
  expect(deps.dispatch).not.toHaveBeenCalled();
  expect(deps.progress).toHaveBeenCalledWith({
    stage: 'EXTRACTION',
    completed: 1,
    total: 1,
  });
});
it('native mode never silently calls a recognition provider', async () => {
  const { input, deps } = setup();
  await expect(
    preparePages({ ...input, providerMode: 'native' }),
  ).rejects.toThrow('DISPATCH_NOT_AUTHORIZED');
  expect(deps.dispatch).not.toHaveBeenCalled();
});
it('collects only schema-valid receipts and never grants publication', async () => {
  const { input, deps } = setup();
  const result = await preparePages(input);
  expect(result.taskCount).toBe(1);
  expect(result.responses).toEqual([response]);
  expect(deps.dispatch).toHaveBeenCalledTimes(1);
  expect(result).not.toHaveProperty('ready');
});
it('rejects a changed page count before paid work', async () => {
  const { input, deps } = setup({ ...prepared, source_page_count: 2 });
  await expect(preparePages(input)).rejects.toThrow('SOURCE_MISMATCH');
  expect(deps.dispatch).not.toHaveBeenCalled();
});
it('rechecks cancellation/deadline immediately before provider dispatch', async () => {
  const { input, deps } = setup();
  let reads = 0;
  await expect(
    preparePages({
      ...input,
      sandboxInput: () => {
        if (++reads > 2) throw Error('deadline');
        return input.sandboxInput();
      },
    }),
  ).rejects.toThrow('deadline');
  expect(deps.dispatch).not.toHaveBeenCalled();
});

it('does not spend on a second page after an explicit first response refusal', async () => {
  const { input, deps } = setup({ ...prepared, source_page_count: 2 });
  deps.dispatch.mockResolvedValue({
    output: JSON.stringify({ ...response, unresolved: ['missing line'] }),
  });
  await expect(preparePages({ ...input, pageLimit: 2 })).rejects.toThrow(
    'UNSUPPORTED_PDF',
  );
  expect(deps.dispatch).toHaveBeenCalledTimes(1);
  expect(deps.progress).not.toHaveBeenCalled();
});

it('refuses mismatched extended-profile pages or tasks before any paid dispatch', async () => {
  for (const packet of [
    { ...prepared, tasks: [] },
    { ...prepared, profile_id: 'ava-pdf-prose-en-uk-v3' as const },
  ]) {
    const { input, deps } = setup(packet);
    await expect(
      preparePages({ ...input, profileId: 'ava-pdf-prose-en-uk-v3' }),
    ).rejects.toThrow('SOURCE_MISMATCH');
    expect(deps.dispatch).not.toHaveBeenCalled();
  }
});
it('passes the extended profile to native preparation without provider overhead', async () => {
  const { input, deps } = setup({
    ...prepared,
    profile_id: 'ava-pdf-prose-en-uk-v3' as const,
    tasks: [],
  });
  expect(
    await preparePages({
      ...input,
      profileId: 'ava-pdf-prose-en-uk-v3',
      providerMode: 'native',
    }),
  ).toEqual({ responses: [], pageCount: 1, taskCount: 0 });
  expect(deps.sandbox).toHaveBeenCalledWith(
    expect.objectContaining({
      auxiliaryBytes: Buffer.from(
        JSON.stringify({
          mode: 'prepare',
          page_number: 1,
          profile_id: 'ava-pdf-prose-en-uk-v3',
        }),
      ),
    }),
  );
  expect(deps.dispatch).not.toHaveBeenCalled();
});
