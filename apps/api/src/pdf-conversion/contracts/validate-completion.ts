import { ContractError } from './contract-error';
import type {
  ContractMap,
  SemanticValidator,
  ValidatedContract,
} from './types';
import { validateContract } from './validate-contract';
import { validateStructure } from './validate-structure';

export async function validateCompletion(
  input: ValidatedContract<ContractMap['ava-pdf-job-1']>,
  completion: { exitCode: number | null; bytes: Buffer },
  semantic: SemanticValidator,
) {
  const expected = { ...input, source: { ...input.source } };
  const expectedExit = completion.exitCode;
  const resultBytes = Buffer.from(completion.bytes);
  // A brand cannot prevent trusted callers from mutating an earlier validated object.
  validateStructure('ava-pdf-job-1', expected);
  await validateContract(
    'ava-pdf-job-1',
    Buffer.from(JSON.stringify(expected)),
    semantic,
  );
  const result = await validateContract(
    'ava-pdf-worker-result-1',
    resultBytes,
    semantic,
  );
  const keys = [
    'operation_id',
    'request_sha256',
    'config_sha256',
    'worker_fingerprint',
    'profile_id',
    'generation',
    'attempt_fence',
    'cancellation_epoch',
  ] as const;
  if (
    keys.some((key) => expected[key] !== result[key]) ||
    result.source_sha256 !== expected.source.sha256 ||
    result.outcome.cli_exit_code !== expectedExit
  ) {
    throw new ContractError('INVALID_CONTRACT');
  }
  const outcome = result.outcome;
  const artifacts =
    outcome.status === 'candidate'
      ? [
          outcome.canonical_book,
          outcome.epub,
          outcome.validation_report,
          ...outcome.resources,
        ]
      : [outcome.diagnostic];
  if (
    artifacts.reduce((sum, artifact) => sum + artifact.byte_length, 0) >
    expected.scratch_byte_limit
  ) {
    throw new ContractError('INVALID_CONTRACT');
  }
  // Retain a candidate even at exit 2. No completion result is publication authority.
  return result;
}
