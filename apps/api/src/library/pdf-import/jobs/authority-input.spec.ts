import { requireAttempt } from './authority';
import { authenticateWorker } from './authenticate-worker';
import type { AttemptAuthority, Tx, WorkerCredential } from './types';
it.each([undefined, '', 'x'.repeat(201)])(
  'rejects malformed attempt ID before database access: %s',
  async (attemptId) => {
    await expect(
      requireAttempt({} as Tx, { attemptId } as AttemptAuthority),
    ).rejects.toThrow('PDF_JOB_AUTHORITY_INVALID');
  },
);
it.each([undefined, '', 'x'.repeat(201)])(
  'rejects malformed principal ID before database access: %s',
  async (principalId) => {
    await expect(
      authenticateWorker({} as Tx, { principalId } as WorkerCredential),
    ).rejects.toThrow('PDF_JOB_AUTHORITY_INVALID');
  },
);
