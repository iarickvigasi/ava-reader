import type { CoordinatorDependencies } from './coordinator-types';
import type { SandboxInput } from '../runtime/container-arguments';
import { geometryTask, geometryParent } from './cell-geometry-fixture';
import { localizeCellGeometry } from './local-cell-geometry';
import { localPacket } from './local-cell-geometry-fixture';

it('binds the exact installed auxiliary request and complete local evidence', async () => {
  const signal = new AbortController().signal;
  const sandbox = jest.fn<
    ReturnType<CoordinatorDependencies['sandbox']>,
    Parameters<CoordinatorDependencies['sandbox']>
  >((input) => {
    expect(input.observationCommand).toEqual({
      command: 'localize_cell_geometry',
      page_number: null,
    });
    return Promise.resolve({
      exitCode: 0,
      stdout: Buffer.from(JSON.stringify(localPacket(input.auxiliaryBytes!))),
      faultAcknowledged: false,
      faultAcknowledgement: undefined,
    });
  });
  const result = await localizeCellGeometry(
    geometryTask,
    geometryParent,
    sandbox,
    () => ({ signal }) as SandboxInput,
    signal,
  );
  expect(result.origin).toBe('LOCAL_OCR');
  expect(result.status).toBe('PROVED');
  expect(sandbox).toHaveBeenCalledTimes(1);
});

it.each([
  'request',
  'task',
  'source',
  'render',
  'raw',
  'tsv',
  'bytes',
  'response',
  'extra',
  'failed',
  'oversize',
])(
  'refuses %s evidence without any external provider fallback in the local command',
  async (kind) => {
    const sandbox = jest.fn<
      ReturnType<CoordinatorDependencies['sandbox']>,
      Parameters<CoordinatorDependencies['sandbox']>
    >((input) => {
      const value = localPacket(input.auxiliaryBytes!);
      if (kind === 'request') value.request_sha256 = 'f'.repeat(64);
      else if (kind === 'task')
        value.task_id = 'recognition-cell-geometry-' + 'f'.repeat(64);
      else if (kind === 'source') value.source_sha256 = 'f'.repeat(64);
      else if (kind === 'render') value.render_sha256 = 'f'.repeat(64);
      else if (kind === 'raw') value.original_response_sha256 = 'f'.repeat(64);
      else if (kind === 'tsv') value.tsv_base64 += '!';
      else if (kind === 'bytes') value.tsv_byte_length++;
      else if (kind === 'response') value.response_sha256 = 'f'.repeat(64);
      else if (kind === 'extra')
        Object.assign(value, { text: 'not-authority' });
      return Promise.resolve({
        exitCode: kind === 'failed' ? 1 : 0,
        stdout:
          kind === 'oversize'
            ? Buffer.alloc(512 * 1024 + 1)
            : Buffer.from(JSON.stringify(value)),
        faultAcknowledged: false,
        faultAcknowledgement: undefined,
      });
    });
    await expect(
      localizeCellGeometry(
        geometryTask,
        geometryParent,
        sandbox,
        () => ({}) as SandboxInput,
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    expect(sandbox).toHaveBeenCalledTimes(1);
  },
);
