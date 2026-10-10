import { decodeArtifact } from './decode-artifact';
import { z } from 'zod';
import { validateCompletion } from '../contracts/validate-completion';
import type {
  ContractMap,
  SemanticValidator,
  ValidatedContract,
} from '../contracts/types';
import { PdfRuntimeError } from './runtime-error';
import type { FaultAcknowledgement } from './fault-acknowledgement';

const bundle = z
  .object({
    version: z.literal('ava-runtime-bundle-1'),
    result: z.unknown(),
    artifacts: z
      .array(z.object({ id: z.string(), base64: z.string() }).strict())
      .max(1003),
  })
  .strict();

export async function decodeBundle(
  job: ValidatedContract<ContractMap['ava-pdf-job-1']>,
  completion: {
    exitCode: number | null;
    stdout: Buffer;
    faultAcknowledged: boolean;
    faultAcknowledgement?: FaultAcknowledgement;
  },
  semantic: SemanticValidator,
) {
  try {
    if (completion.stdout.length > 32 * 1024 ** 2) throw new Error('Bound');
    const parsed: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(completion.stdout),
    );
    const runtimeError = z
      .object({
        version: z.literal('ava-runtime-error-1'),
        code: z.enum(['RESOURCE_LIMIT', 'WORKER_FAILED', 'LEASE_EXPIRED']),
      })
      .strict()
      .safeParse(parsed);
    if (runtimeError.success)
      throw new PdfRuntimeError(
        runtimeError.data.code === 'RESOURCE_LIMIT'
          ? 'RESOURCE_LIMIT'
          : runtimeError.data.code === 'LEASE_EXPIRED'
            ? 'DISPATCH_NOT_AUTHORIZED'
            : 'WORKER_CRASH',
        completion.faultAcknowledgement,
      );
    const raw = bundle.parse(parsed);
    const bytes = Buffer.from(JSON.stringify(raw.result));
    const result = await validateCompletion(
      job,
      { exitCode: completion.exitCode, bytes },
      semantic,
    );
    const outcome = result.outcome;
    const descriptors =
      outcome.status === 'candidate'
        ? [
            outcome.canonical_book,
            outcome.epub,
            outcome.validation_report,
            ...outcome.resources,
          ]
        : [outcome.diagnostic];
    if (
      raw.artifacts.length !== descriptors.length ||
      new Set(raw.artifacts.map((item) => item.id)).size !==
        raw.artifacts.length ||
      descriptors.reduce((total, item) => total + item.byte_length, 0) >
        16 * 1024 ** 2
    )
      throw new Error('Inventory');
    const artifacts = descriptors.map((descriptor) => {
      const item = raw.artifacts.find((entry) => entry.id === descriptor.id);
      if (!item) throw new Error('Missing');
      return decodeArtifact(item.base64, descriptor);
    });
    return {
      completion: { exitCode: completion.exitCode, bytes },
      artifacts,
      faultAcknowledged: completion.faultAcknowledged,
      faultAcknowledgement: completion.faultAcknowledgement,
    };
  } catch (error) {
    if (error instanceof PdfRuntimeError) throw error;
    throw new PdfRuntimeError('INVALID_RESULT');
  }
}
