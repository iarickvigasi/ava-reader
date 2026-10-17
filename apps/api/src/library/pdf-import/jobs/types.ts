import type { Prisma } from '@prisma/client';
import type { JobInputV1 } from '../../../pdf-conversion/contracts/generated/ava-pdf-job-1';
export type WorkerCredential = { principalId: string; token: string };
export type AttemptAuthority = WorkerCredential & {
  attemptId: string;
  attemptToken: string;
};
export type JobStage =
  | 'PREFLIGHT'
  | 'EXTRACTION'
  | 'RECONSTRUCTION'
  | 'ASSEMBLY'
  | 'VALIDATION';
export type JobProgress = {
  stage: JobStage;
  completed?: number;
  total?: number;
  observationWatermark?: unknown;
};
export type ExecutionFailure =
  | 'WORKER_CRASH'
  | 'LEASE_EXPIRED'
  | 'EXECUTION_TIMEOUT'
  | 'RESOURCE_LIMIT'
  | 'INVALID_RESULT'
  | 'SOURCE_MISMATCH'
  | 'DISPATCH_NOT_AUTHORIZED'
  | 'UNSUPPORTED_PDF'
  | 'CONVERSION_FAILED';
export type ClaimedPdfJob = {
  jobId?: string;
  authority: AttemptAuthority;
  job: JobInputV1;
  leaseExpiresAt: Date;
  deadlineAt: Date;
  artifactByteLimit: number;
  serverNow: Date;
  leaseRemainingMs: number;
  deadlineRemainingMs: number;
};
export type AttemptRecord = Prisma.PdfJobAttemptGetPayload<{
  include: { job: { include: { operation: true } } };
}>;
export type Tx = Prisma.TransactionClient;
