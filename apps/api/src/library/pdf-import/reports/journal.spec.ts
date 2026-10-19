import type { Tx } from '../jobs/types';
import { appendConversionEvent } from './append-event';
import { eventPageCursor, parseEventPage } from './cursor';
import { eventIdentity } from './event-contract';
it('duplicate producer delivery returns its original sequence without allocating a new event', async () => {
  const event = {
    kind: 'FAILED' as const,
    stage: 'EXTRACTION',
    severity: 'ERROR' as const,
    details: {},
  };
  const prior = {
    sequence: 4,
    payloadSha256: eventIdentity('producer', event).payloadSha256,
  };
  const tx = {
    $executeRaw: jest.fn(),
    pdfConversionEvent: {
      findUnique: jest.fn().mockResolvedValue(prior),
      create: jest.fn(),
    },
    pdfConversionInvestigation: { update: jest.fn() },
  };
  expect(
    await appendConversionEvent(
      tx as unknown as Tx,
      'conversion',
      'producer',
      event,
    ),
  ).toBe(prior);
  expect(tx.pdfConversionInvestigation.update).not.toHaveBeenCalled();
  expect(tx.pdfConversionEvent.create).not.toHaveBeenCalled();
});
it('conflicting producer replay refuses to rewrite the original event', async () => {
  const tx = {
    $executeRaw: jest.fn(),
    pdfConversionEvent: {
      findUnique: jest.fn().mockResolvedValue({ payloadSha256: 'other' }),
      create: jest.fn(),
    },
    pdfConversionInvestigation: { update: jest.fn() },
  };
  await expect(
    appendConversionEvent(tx as unknown as Tx, 'conversion', 'producer', {
      kind: 'FAILED',
      stage: 'EXTRACTION',
      severity: 'ERROR',
      details: {},
    }),
  ).rejects.toThrow('PDF_REPORT_EVENT_CONFLICT');
});
it('page cursor preserves a fixed watermark and rejects another conversion or invalid bounds', () => {
  const cursor = eventPageCursor('one', 12, 6);
  expect(parseEventPage('one', 20, cursor, '2')).toEqual({
    watermark: 12,
    after: 6,
    limit: 2,
  });
  expect(() => parseEventPage('other', 20, cursor)).toThrow();
  expect(() => parseEventPage('one', 4, cursor)).toThrow();
  expect(() => parseEventPage('one', 20, undefined, '1000')).toThrow();
});
