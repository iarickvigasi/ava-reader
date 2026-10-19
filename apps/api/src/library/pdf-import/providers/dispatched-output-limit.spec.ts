import { dispatchedOutputLimit } from './dispatched-output-limit';
import { checksumBuffer } from '../../../shared/blob-utils';
import { config, route, task } from './test-fixtures';
import { prepareProviderRequest } from './prepare-request';
import type { RouteConfiguration } from './types';
const policy = {
  ...config,
  maxOutputTokensByPrompt: { [task.promptVersion]: 16384 },
} as RouteConfiguration;
function fixture(limit = 3072) {
  const bytes = prepareProviderRequest(
    { ...route, configuration: policy },
    { ...task, maxOutputTokens: limit },
  ).request;
  const hash = checksumBuffer(bytes);
  return {
    id: 'call',
    promptVersion: task.promptVersion,
    requestSha256: hash,
    grant: { ownerId: 'owner', route: { modelId: route.modelId } },
    payloads: [
      {
        callId: 'call',
        ownerId: 'owner',
        kind: 'REQUEST',
        checksum: hash,
        sizeBytes: bytes.length,
        blob: { bytes, checksum: hash, sizeBytes: bytes.length },
      },
    ],
  };
}
it('reads the exact dispatched task cap rather than its larger prompt/route ceiling', () =>
  expect(dispatchedOutputLimit(fixture(), policy)).toEqual({
    limit: 3072,
    status: 'VERIFIED_REQUEST',
  }));
it('uses a declared route fallback only for a legacy missing request', () =>
  expect(
    dispatchedOutputLimit(
      { ...fixture(), payloads: [] },
      config as RouteConfiguration,
    ),
  ).toEqual({ limit: 32768, status: 'LEGACY_ROUTE' }));
it('marks a missing opt-in request unverified while retaining a bounded fallback', () =>
  expect(dispatchedOutputLimit({ ...fixture(), payloads: [] }, policy)).toEqual(
    { limit: 16384, status: 'UNVERIFIED' },
  ));
it.each([
  'owner',
  'call',
  'hash',
  'size',
  'blob-hash',
  'blob-size',
  'kind',
  'bytes',
  'duplicate',
])('refuses %s proof corruption', (fault) => {
  const c = fixture();
  const p = c.payloads[0];
  if (fault === 'owner') p.ownerId = 'foreign';
  if (fault === 'call') p.callId = 'other';
  if (fault === 'hash') p.checksum = '0'.repeat(64);
  if (fault === 'size') p.sizeBytes++;
  if (fault === 'blob-hash') p.blob.checksum = '0'.repeat(64);
  if (fault === 'blob-size') p.blob.sizeBytes++;
  if (fault === 'kind') p.kind = 'RESPONSE';
  if (fault === 'bytes') p.blob.bytes = Buffer.from('changed');
  if (fault === 'duplicate') c.payloads.push(p);
  expect(dispatchedOutputLimit(c, policy).status).toBe('UNVERIFIED');
});
it.each([0, -1, 1.5, '3072', null, 16385])(
  'refuses unauthorized exact stored max_tokens %s',
  (limit) => {
    const c = fixture();
    const p = c.payloads[0];
    p.blob.bytes = Buffer.from(
      JSON.stringify({ model: route.modelId, max_tokens: limit }),
    );
    p.sizeBytes = p.blob.sizeBytes = p.blob.bytes.length;
    c.requestSha256 =
      p.checksum =
      p.blob.checksum =
        checksumBuffer(p.blob.bytes);
    expect(dispatchedOutputLimit(c, policy).status).toBe('UNVERIFIED');
  },
);
