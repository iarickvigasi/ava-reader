import { createHash } from 'node:crypto';
import type { CoordinatorDependencies } from './coordinator-types';
import type { SandboxInput } from '../runtime/container-arguments';
import { response } from './test-fixture';
import { refinementTask, refinementResponse } from './refinement-fixture';
export function refinementSetup() {
  const events: string[] = [];
  const sandbox = jest.fn((input: SandboxInput) => {
    const request = JSON.parse(input.auxiliaryBytes!.toString()) as {
      mode: string;
    };
    events.push(request.mode);
    return Promise.resolve({
      exitCode: 0,
      faultAcknowledged: false,
      faultAcknowledgement: undefined,
      stdout: Buffer.from(
        JSON.stringify(
          request.mode === 'prepare_refinement'
            ? {
                schema_version: 'ava-book-refinement-batch-1',
                source_sha256: refinementTask.source_sha256,
                tasks: [refinementTask],
              }
            : {
                schema_version: 'ava-refinement-validation-1',
                valid: true,
                request_sha256: createHash('sha256')
                  .update(input.auxiliaryBytes!)
                  .digest('hex'),
              },
        ),
      ),
    });
  });
  const dispatch = jest
    .fn<
      ReturnType<CoordinatorDependencies['dispatch']>,
      Parameters<CoordinatorDependencies['dispatch']>
    >()
    .mockImplementation(() => {
      events.push('dispatch');
      return Promise.resolve({ output: JSON.stringify(refinementResponse) });
    });
  const input = {
    responses: [response],
    sourceSha256: refinementTask.source_sha256,
    providerMode: 'stub',
    deps: {
      sandbox,
      dispatch,
      stageArtifact: jest.fn<
        ReturnType<CoordinatorDependencies['stageArtifact']>,
        Parameters<CoordinatorDependencies['stageArtifact']>
      >(),
      progress: jest.fn<
        ReturnType<CoordinatorDependencies['progress']>,
        Parameters<CoordinatorDependencies['progress']>
      >(),
    },
    sandboxInput: (): SandboxInput => ({
      module: 'ava_pdf_epub.reconstruction_v2',
      source: Buffer.from('source'),
      deadlineMs: 1000,
      scratchBytes: 1000,
    }),
  };
  return { input, sandbox, dispatch, events };
}
