import {
  geometryParent as cellParent,
  geometryTask as cellTask,
} from './cell-geometry-fixture';
import { validateGeometry } from './validate-geometry';
import { geometryParent, geometryTask } from './geometry-fixture';
import { geometrySha } from './geometry-binding';
import type { CoordinatorDependencies } from './coordinator-types';
import type { SandboxInput } from '../runtime/container-arguments';

describe.each([
  [geometryTask, geometryParent],
  [cellTask, cellParent],
])('geometry preflight %s', (repairTask, parentTask) => {
  it('uses exact independent request bytes and merged cancellation before paid repair', async () => {
    const outer = new AbortController(),
      session = new AbortController();
    let request = '';
    const sandbox = jest.fn<
      ReturnType<CoordinatorDependencies['sandbox']>,
      Parameters<CoordinatorDependencies['sandbox']>
    >((input) => {
      request = input.auxiliaryBytes!.toString();
      expect(input.observationCommand).toEqual({
        command: 'validate_geometry',
        page_number: null,
      });
      session.abort();
      expect(input.signal!.aborted).toBe(true);
      return Promise.resolve({
        exitCode: 0,
        stdout: Buffer.from(
          JSON.stringify({
            schema_version: 'ava-recognition-geometry-validation-1',
            valid: true,
            request_sha256: geometrySha(request),
          }),
        ),
        faultAcknowledged: false,
        faultAcknowledgement: undefined,
      });
    });
    await validateGeometry(
      repairTask,
      parentTask,
      sandbox,
      () => ({ signal: outer.signal }) as SandboxInput,
      session.signal,
    );
    expect(JSON.parse(request)).toEqual({
      mode: 'validate_geometry',
      task: repairTask,
      original: parentTask,
      response: null,
    });
  });
  it.each(['marker', 'hash', 'valid', 'extra', 'failed', 'oversize'])(
    'rejects %s predispatch evidence',
    async (kind) => {
      const sandbox = jest.fn<
        ReturnType<CoordinatorDependencies['sandbox']>,
        Parameters<CoordinatorDependencies['sandbox']>
      >((input) => {
        const value = {
          schema_version: 'ava-recognition-geometry-validation-1',
          valid: true,
          request_sha256: geometrySha(input.auxiliaryBytes!.toString()),
        };
        if (kind === 'marker') value.schema_version = 'foreign';
        else if (kind === 'hash') value.request_sha256 = 'e'.repeat(64);
        else if (kind === 'valid') value.valid = false;
        else if (kind === 'extra') Object.assign(value, { granted: true });
        return Promise.resolve({
          exitCode: kind === 'failed' ? 1 : 0,
          stdout:
            kind === 'oversize'
              ? Buffer.alloc(1025)
              : Buffer.from(JSON.stringify(value)),
          faultAcknowledged: false,
          faultAcknowledgement: undefined,
        });
      });
      await expect(
        validateGeometry(
          repairTask,
          parentTask,
          sandbox,
          () => ({}) as SandboxInput,
          new AbortController().signal,
        ),
      ).rejects.toThrow();
    },
  );
});
