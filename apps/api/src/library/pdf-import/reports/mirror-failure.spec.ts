import type { Tx } from '../jobs/types';
import { isolateReportMirror } from './refresh-cost';
it('an event-sink or cost-projection error rolls back only its savepoint', async () => {
  const tx = {
    $executeRawUnsafe: jest
      .fn<Promise<number>, [string]>()
      .mockResolvedValue(0),
  };
  expect(
    await isolateReportMirror(tx as unknown as Tx, () =>
      Promise.reject(new Error('event sink unavailable')),
    ),
  ).toBe(false);
  expect(tx.$executeRawUnsafe.mock.calls.map((args) => args[0])).toEqual([
    'SAVEPOINT ava_pdf_report_mirror',
    'ROLLBACK TO SAVEPOINT ava_pdf_report_mirror',
    'RELEASE SAVEPOINT ava_pdf_report_mirror',
  ]);
});
it('an expired/disconnected transaction cannot masquerade as safely recovered', async () => {
  const tx = {
    $executeRawUnsafe: jest
      .fn()
      .mockResolvedValueOnce(0)
      .mockRejectedValue(new Error('transaction expired')),
  };
  await expect(
    isolateReportMirror(tx as unknown as Tx, () =>
      Promise.reject(new Error('projection failure')),
    ),
  ).rejects.toThrow('transaction expired');
});
