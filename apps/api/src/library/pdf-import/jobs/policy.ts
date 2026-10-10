import { z } from 'zod';
import { PdfJobError } from './errors';
import { MAX_ACTIVE_DEADLINE_MS } from '../../../pdf-conversion/contracts/execution-limits';
export const ARTIFACT_BYTE_LIMIT = 64 * 1024 * 1024;
export const DEFAULT_JOB_POLICY = Object.freeze({
  version: 1,
  maxAttempts: 3,
  leaseMs: 30000,
  totalTimeoutMs: MAX_ACTIVE_DEADLINE_MS,
  retryDelayMs: 1000,
  globalConcurrency: 2,
  ownerConcurrency: 1,
  principalConcurrency: 1,
  globalQueueLimit: 100,
  ownerQueueLimit: 10,
  scratchByteLimit: 2147483648,
});
const schema = z
  .object({
    version: z.literal(1),
    maxAttempts: z.number().int().min(1).max(3),
    leaseMs: z.number().int().min(100).max(30000),
    totalTimeoutMs: z.number().int().min(1000).max(MAX_ACTIVE_DEADLINE_MS),
    retryDelayMs: z.number().int().min(0).max(30000),
    globalConcurrency: z.number().int().min(1).max(2),
    ownerConcurrency: z.literal(1),
    principalConcurrency: z.literal(1),
    globalQueueLimit: z.number().int().min(1).max(100),
    ownerQueueLimit: z.number().int().min(1).max(10),
    scratchByteLimit: z.number().int().min(1048576).max(2147483648),
  })
  .strict();
export type JobPolicy = z.infer<typeof schema>;
export function parseJobPolicy(value: unknown): JobPolicy {
  const result = schema.safeParse(value);
  if (!result.success) throw new PdfJobError('PDF_JOB_POLICY_INVALID');
  return result.data;
}
export function configuredJobPolicy(): JobPolicy {
  const override = process.env.AVA_PDF_TEST_JOB_POLICY;
  if (!override) return parseJobPolicy(DEFAULT_JOB_POLICY);
  if (process.env.NODE_ENV !== 'test' || process.env.AVA_PDF_TEST_HOOKS !== '1')
    throw new PdfJobError('PDF_TEST_HOOKS_DISABLED');
  try {
    const value: unknown = JSON.parse(override);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error();
    return parseJobPolicy({ ...DEFAULT_JOB_POLICY, ...value });
  } catch {
    throw new PdfJobError('PDF_JOB_POLICY_INVALID');
  }
}
