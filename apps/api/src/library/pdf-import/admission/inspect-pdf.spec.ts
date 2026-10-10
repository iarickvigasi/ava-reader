import {
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { inspectPdf } from './inspect-pdf';
import { inspectPdfIsolated } from '../../../pdf-conversion/runtime/inspect-isolated';
import { runtimeConfigFromEnvironment } from '../../../pdf-conversion/runtime/runtime-config';

jest.mock('../../../pdf-conversion/runtime/inspect-isolated');
jest.mock('../../../pdf-conversion/runtime/runtime-config');
const isolated = jest.mocked(inspectPdfIsolated);
const configuration = jest.mocked(runtimeConfigFromEnvironment);
const digest = 'a'.repeat(64);
const source = Buffer.from('%PDF-1.7');
const inspection = {
  source_sha256: digest,
  page_count: 1,
  metadata: { Title: 'Test book' },
  pages: [{ width: 600, height: 800 }],
};

beforeEach(() => {
  jest.resetAllMocks();
  configuration.mockImplementation(() => ({ enabled: true }) as never);
});

it('accepts only an isolated result bound to the supplied source', async () => {
  isolated.mockResolvedValue(
    Buffer.from(JSON.stringify({ accepted: true, inspection })),
  );
  await expect(inspectPdf(source, digest)).resolves.toEqual(inspection);
  expect(isolated).toHaveBeenCalledWith(source, digest, { enabled: true });
});

it.each([
  {
    accepted: true,
    inspection: { ...inspection, source_sha256: 'b'.repeat(64) },
  },
  { accepted: true, inspection: { ...inspection, page_count: 2 } },
  {
    accepted: true,
    inspection: { ...inspection, pages: [{ width: -1, height: 800 }] },
  },
  { accepted: true },
  { accepted: true, inspection, arbitraryPath: '/outside' },
])('refuses mismatched or malformed isolated envelopes', async (envelope) => {
  isolated.mockResolvedValue(Buffer.from(JSON.stringify(envelope)));
  await expect(inspectPdf(source, digest)).rejects.toBeInstanceOf(
    ServiceUnavailableException,
  );
});

it('retains a typed unsupported-input outcome', async () => {
  isolated.mockResolvedValue(
    Buffer.from('{"accepted":false,"code":"PDF_ENCRYPTED"}'),
  );
  await expect(inspectPdf(source, digest)).rejects.toMatchObject({
    response: { code: 'PDF_ENCRYPTED' },
  });
  await expect(inspectPdf(source, digest)).rejects.toBeInstanceOf(
    UnprocessableEntityException,
  );
});

it('fails closed without runtime configuration and never falls back to a host parser', async () => {
  configuration.mockImplementation(() => {
    throw new Error('runtime unavailable');
  });
  await expect(inspectPdf(source, digest)).rejects.toBeInstanceOf(
    ServiceUnavailableException,
  );
  expect(isolated).not.toHaveBeenCalled();
});

it('refuses malformed UTF-8 instead of silently changing metadata', async () => {
  const encoded = Buffer.from(JSON.stringify({ accepted: true, inspection }));
  encoded[encoded.indexOf('Test book')] = 0xff;
  isolated.mockResolvedValue(encoded);
  await expect(inspectPdf(source, digest)).rejects.toBeInstanceOf(
    ServiceUnavailableException,
  );
});

const finding = {
  page_number: 2,
  annotation_number: 1,
  relationship_path: ['/Popup'],
};
it('preserves a bounded content-free refusal location', async () => {
  isolated.mockResolvedValue(
    Buffer.from(
      JSON.stringify({
        accepted: false,
        code: 'PDF_ACTIVE_CONTENT_UNSUPPORTED',
        finding,
      }),
    ),
  );
  await expect(inspectPdf(source, digest)).rejects.toMatchObject({
    response: { code: 'PDF_ACTIVE_CONTENT_UNSUPPORTED', finding },
  });
});
it.each([
  { ...finding, page_number: 0 },
  { ...finding, annotation_number: 1001 },
  { ...finding, relationship_path: ['/Contents'] },
  { ...finding, relationship_path: Array(21).fill('/Popup') },
  { ...finding, contents: 'private note' },
])('refuses invalid or private diagnostic fields', async (invalid) => {
  isolated.mockResolvedValue(
    Buffer.from(
      JSON.stringify({
        accepted: false,
        code: 'PDF_ANNOTATION_INVALID',
        finding: invalid,
      }),
    ),
  );
  await expect(inspectPdf(source, digest)).rejects.toBeInstanceOf(
    ServiceUnavailableException,
  );
});
it.each([
  { accepted: true, inspection, finding },
  { accepted: true, inspection, code: 'PDF_INVALID' },
  { accepted: false, finding },
])('refuses inconsistent diagnostic envelopes', async (envelope) => {
  isolated.mockResolvedValue(Buffer.from(JSON.stringify(envelope)));
  await expect(inspectPdf(source, digest)).rejects.toBeInstanceOf(
    ServiceUnavailableException,
  );
});
