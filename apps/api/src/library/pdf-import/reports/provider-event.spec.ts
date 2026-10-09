import type { Tx } from '../jobs/types';
import { recordPdfProviderEvent } from './provider-event';
it('preserves the authoritative settled event when the report-event sink fails', async () => {
  const event = {
    id: 'receipt-event',
    callId: 'call',
    kind: 'SETTLED',
    createdAt: new Date(),
    details: {},
  };
  const tx = {
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    pdfProviderEvent: { create: jest.fn().mockResolvedValue(event) },
    pdfProviderCall: {
      findUniqueOrThrow: jest
        .fn()
        .mockRejectedValue(new Error('mirror sink unavailable')),
    },
  };
  expect(
    await recordPdfProviderEvent(tx as unknown as Tx, {
      data: {
        callId: 'call',
        kind: 'SETTLED',
        evidenceSha256: 'a'.repeat(64),
        details: {},
      },
    }),
  ).toBe(event);
  expect(tx.pdfProviderEvent.create).toHaveBeenCalledTimes(1);
  expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
    'ROLLBACK TO SAVEPOINT ava_pdf_report_mirror',
  );
});
