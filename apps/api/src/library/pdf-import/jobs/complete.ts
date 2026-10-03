import type { PrismaService } from '../../../prisma/prisma.service';
import { validateCompletion } from '../../../pdf-conversion/contracts/validate-completion';
import { validateContract } from '../../../pdf-conversion/contracts/validate-contract';
import type { SemanticValidator } from '../../../pdf-conversion/contracts/types';
import { checksumBuffer } from '../../../shared/blob-utils';
import type { AttemptAuthority } from './types';
import { jobTransaction, databaseNow } from './transaction';
import { requireAttempt } from './authority';
import { assertAttemptScope } from './scope-checks';
import {
  snapshotArtifactBytes,
  validateArtifactBytes,
  type ArtifactBytes,
} from './result-artifacts';
import { persistArtifacts } from './persist-artifacts';
import { acceptResult } from './accept-result';
import { MAX_CONTRACT_BYTES } from '../../../pdf-conversion/contracts/parse-json';
import { stageArtifacts } from './stage-artifacts';
import { JobAuthorityError, PdfJobError } from './errors';
export async function completePdfJob(
  prisma: PrismaService,
  input: {
    authority: AttemptAuthority;
    completion: { exitCode: number | null; bytes: Buffer };
    artifacts: ArtifactBytes[];
    semantic: SemanticValidator;
  },
) {
  if (
    !Buffer.isBuffer(input.completion.bytes) ||
    input.completion.bytes.length > MAX_CONTRACT_BYTES
  )
    throw new PdfJobError('PDF_JOB_RESULT_LIMIT');
  const authority = { ...input.authority },
    completion = {
      exitCode: input.completion.exitCode,
      bytes: Buffer.from(input.completion.bytes),
    };
  const artifacts = snapshotArtifactBytes(input.artifacts),
    semantic = input.semantic,
    resultSha256 = checksumBuffer(completion.bytes);
  const scope = await jobTransaction(prisma, (tx) =>
    requireAttempt(tx, authority, true),
  );
  const job = await validateContract(
    'ava-pdf-job-1',
    Buffer.from(JSON.stringify(scope.job)),
    semantic,
  );
  const result = await validateCompletion(job, completion, semantic);
  validateArtifactBytes(result, artifacts);
  const staged = scope.attempt.resultSha256
    ? null
    : await stageArtifacts(prisma, scope.job.owner_id, result, artifacts);
  return jobTransaction(prisma, async (tx) => {
    const { attempt } = await requireAttempt(tx, authority, true);
    if (attempt.resultSha256) {
      if (attempt.resultSha256 !== resultSha256) throw new JobAuthorityError();
      return {
        status: attempt.job.operation.status,
        failureId: attempt.job.operation.failureId,
      };
    }
    const artifactMap = await persistArtifacts(tx, attempt, result, staged!);
    const now = await databaseNow(tx);
    assertAttemptScope(attempt, now, false);
    return acceptResult(tx, attempt, result, resultSha256, artifactMap, now);
  });
}
