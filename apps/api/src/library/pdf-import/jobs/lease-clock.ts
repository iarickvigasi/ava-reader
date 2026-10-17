import { databaseNow } from './transaction';
import type { Tx } from './types';
export async function leaseClock(tx: Tx, lease: Date, deadline: Date) {
  const serverNow = await databaseNow(tx);
  return {
    serverNow,
    leaseRemainingMs: Math.max(0, lease.getTime() - serverNow.getTime()),
    deadlineRemainingMs: Math.max(0, deadline.getTime() - serverNow.getTime()),
  };
}
