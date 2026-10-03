import { z } from 'zod';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const schema = z
  .object({
    deletedGraceMs: z
      .number()
      .int()
      .min(1)
      .max(720 * HOUR),
    failedWorkMs: z
      .number()
      .int()
      .min(1)
      .max(90 * DAY),
  })
  .strict();
export function pdfRetentionPolicy() {
  const deleted = z.coerce
    .number()
    .int()
    .min(1)
    .max(720)
    .parse(process.env.AVA_PDF_RETENTION_DELETED_HOURS ?? 24);
  const failed = z.coerce
    .number()
    .int()
    .min(1)
    .max(90)
    .parse(process.env.AVA_PDF_RETENTION_FAILED_DAYS ?? 7);
  let value: unknown = {
    deletedGraceMs: deleted * HOUR,
    failedWorkMs: failed * DAY,
  };
  if (process.env.AVA_PDF_TEST_RETENTION_POLICY) {
    if (
      process.env.NODE_ENV !== 'test' ||
      process.env.AVA_PDF_TEST_HOOKS !== '1'
    )
      throw new Error('PDF_RETENTION_TEST_HOOK_DISABLED');
    value = JSON.parse(process.env.AVA_PDF_TEST_RETENTION_POLICY);
  }
  return schema.parse(value);
}
export function pdfRetentionSummary() {
  const policy = pdfRetentionPolicy();
  return {
    deletedGraceHours: policy.deletedGraceMs / HOUR,
    failedWorkDays: policy.failedWorkMs / DAY,
    timing: 'eligible_after' as const,
    backups: 'may_remain_longer' as const,
  };
}
