import {
  requireReportsProofDatabase,
  syntheticSource,
} from './pdf-reports-proof';
import { checksumBuffer } from '../shared/blob-utils';

it('requires explicit synthetic opt-in and rejects the real/default database before opening a client', () => {
  expect(() =>
    requireReportsProofDatabase({
      DATABASE_URL:
        'postgresql://user:secret@localhost:55417/ava_pdf_reports_test',
    }),
  ).toThrow('OPT_IN');
  for (const value of [
    'postgresql://user:secret@localhost:5432/ava_reader',
    'postgresql://user:secret@example.com:55417/ava_pdf_reports_test',
    'postgresql://user:secret@localhost:55417/ava_pdf_reports_test?schema=other',
  ]) {
    expect(() =>
      requireReportsProofDatabase({
        AVA_PDF_REPORTS_PROOF: 'synthetic-only',
        DATABASE_URL: value,
      }),
    ).toThrow('WRONG_DATABASE');
  }
});
it('creates a valid staging manifest with actual byte length/checksum and a nonnull future expiry', () => {
  const now = new Date('2026-10-09T00:00:00Z');
  const source = syntheticSource(now);
  expect(source.retention).toBe('STAGING');
  expect(source.expiresAt.getTime()).toBeGreaterThan(now.getTime());
  expect(source.sizeBytes).toBe(source.bytes.length);
  expect(source.sizeBytes).toBe(9);
  expect(source.checksum).toBe(checksumBuffer(source.bytes));
});
it('accepts only the dedicated loopback database and does not connect or write fixtures', () => {
  expect(() =>
    requireReportsProofDatabase({
      AVA_PDF_REPORTS_PROOF: 'synthetic-only',
      DATABASE_URL:
        'postgresql://user:secret@127.0.0.1:55417/ava_pdf_reports_test?schema=public',
    }),
  ).not.toThrow();
});
