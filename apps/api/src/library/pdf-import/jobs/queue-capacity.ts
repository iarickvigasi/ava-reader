import { ServiceUnavailableException } from '@nestjs/common';
import type { Tx } from './types';
import { configuredJobPolicy } from './policy';
import { queueLock } from './transaction';
export async function assertPdfQueueCapacity(tx: Tx, ownerId: string) {
  await queueLock(tx);
  const policy = configuredJobPolicy();
  const active = {
    state: { in: ['QUEUED', 'RUNNING'] as ('QUEUED' | 'RUNNING')[] },
  };
  const count = await tx.pdfConversionJob.count({ where: active });
  const owned = await tx.pdfConversionJob.count({
    where: { ...active, operation: { ownerId, deletedAt: null } },
  });
  if (count >= policy.globalQueueLimit || owned >= policy.ownerQueueLimit)
    throw new ServiceUnavailableException({
      code: 'PDF_QUEUE_FULL',
      message: 'PDF processing is busy. Please try importing later.',
    });
  return policy;
}
