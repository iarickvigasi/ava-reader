import type { JobInputV1 } from '../contracts/generated/ava-pdf-job-1';
import type { ProviderTask } from '../../library/pdf-import/providers/types';
import type { JobProgress } from '../../library/pdf-import/jobs';
import type { SandboxInput } from '../runtime/container-arguments';
import type { StreamArtifact } from '../runtime/stream-schema';
import type { runSandbox } from '../runtime/run-sandbox';
export type CoordinatorDependencies = {
  sandbox: (input: SandboxInput) => ReturnType<typeof runSandbox>;
  dispatch: (task: ProviderTask) => Promise<{ output: string }>;
  stageArtifact: (artifact: StreamArtifact, bytes: Buffer) => Promise<string>;
  progress: (progress: JobProgress) => Promise<void>;
};
export type CoordinatorInput = {
  job: JobInputV1;
  source: Buffer;
  signal: AbortSignal;
  leaseRemainingMs: () => number;
};
