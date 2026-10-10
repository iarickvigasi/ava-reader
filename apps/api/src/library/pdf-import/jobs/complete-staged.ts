import type { PrismaService } from '../../../prisma/prisma.service';
import type { SemanticValidator } from '../../../pdf-conversion/contracts/types';
import { validateContract } from '../../../pdf-conversion/contracts/validate-contract';
import { validateCompletion } from '../../../pdf-conversion/contracts/validate-completion';
import { MAX_CONTRACT_BYTES } from '../../../pdf-conversion/contracts/parse-json';
import { checksumBuffer } from '../../../shared/blob-utils';
import type { AttemptAuthority } from './types';
import { jobTransaction, databaseNow } from './transaction';
import { requireAttempt } from './authority';
import { assertAttemptScope } from './scope-checks';
import { resultArtifacts } from './result-artifacts';
import { persistArtifacts } from './persist-artifacts';
import { acceptResult } from './accept-result';
import { JobAuthorityError, PdfJobError } from './errors';
import { readObservationWatermark } from '../reports/observation-contract';
export async function completeStagedPdfJob(
  prisma: PrismaService,
  input: {
    authority: AttemptAuthority;
    completion: { exitCode: number | null; bytes: Buffer };
    stagedByPath: Record<string, string>;
    semantic: SemanticValidator;
    observationWatermark?: unknown;
  },
) {
  if (
    !Buffer.isBuffer(input.completion.bytes) ||
    input.completion.bytes.length > MAX_CONTRACT_BYTES
  )
    throw new PdfJobError('PDF_JOB_RESULT_LIMIT');
  const authority = { ...input.authority },
    completion = {
      ...input.completion,
      bytes: Buffer.from(input.completion.bytes),
    },
    staged = { ...input.stagedByPath },
    sha = checksumBuffer(completion.bytes);
  const capture = readObservationWatermark(input, authority.attemptId);
  const scope = await jobTransaction(prisma, (tx) =>
    requireAttempt(tx, authority, true),
  );
  const job = await validateContract(
    'ava-pdf-job-1',
    Buffer.from(JSON.stringify(scope.job)),
    input.semantic,
  );
  const result = await validateCompletion(job, completion, input.semantic);
  const descriptors = resultArtifacts(result);
  if (
    result.outcome.status !== 'candidate' ||
    result.outcome.canonical_schema !== 'ava-book-2' ||
    descriptors.length !== Object.keys(staged).length ||
    descriptors.some(
      (d) =>
        !Object.hasOwn(staged, d.path) ||
        typeof staged[d.path] !== 'string' ||
        !staged[d.path],
    ) ||
    new Set(Object.values(staged)).size !== descriptors.length ||
    descriptors.reduce((n, d) => n + d.byte_length, 0) > 512 * 1024 ** 2
  )
    throw new PdfJobError('PDF_JOB_ARTIFACT_INVALID');
  const mapping = Object.fromEntries(
    descriptors.map((d) => [d.id, staged[d.path]]),
  );
  return jobTransaction(prisma, async (tx) => {
    const { attempt } = await requireAttempt(tx, authority, true);
    if (attempt.resultSha256) {
      if (attempt.resultSha256 !== sha) throw new JobAuthorityError();
      return {
        status: attempt.job.operation.status,
        failureId: attempt.job.operation.failureId,
      };
    }
    await persistArtifacts(tx, attempt, result, mapping);
    const now = await databaseNow(tx);
    assertAttemptScope(attempt, now, false);
    return acceptResult(tx, attempt, result, sha, mapping, now, capture);
  });
}
