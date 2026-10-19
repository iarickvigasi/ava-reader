import { checksumBuffer } from '../../../shared/blob-utils';
import type { RouteConfiguration } from './types';
import { outputTokenLimit } from './output-token-limit';
type Payload = {
  callId: string;
  ownerId: string;
  kind: string;
  checksum: string;
  sizeBytes: number;
  blob: { bytes: Uint8Array; checksum: string; sizeBytes: number };
};
type Call = {
  id: string;
  requestSha256: string;
  promptVersion: string;
  grant: { ownerId: string; route: { modelId: string } };
  payloads: Payload[];
};
/** Private request proof is optional for old/deleted payloads; missing new proof never erases a known charge. */
export function dispatchedOutputLimit(
  call: Call,
  config: RouteConfiguration,
): {
  limit: number;
  status: 'VERIFIED_REQUEST' | 'LEGACY_ROUTE' | 'UNVERIFIED';
} {
  const ceiling = outputTokenLimit(config, call.promptVersion),
    payloads = call.payloads ?? [];
  const fallback = {
    limit: ceiling,
    status:
      config.maxOutputTokensByPrompt === undefined
        ? 'LEGACY_ROUTE'
        : 'UNVERIFIED',
  } as const;
  if (!payloads.length) return fallback;
  if (payloads.length !== 1) return { limit: ceiling, status: 'UNVERIFIED' };
  try {
    const p = payloads[0];
    if (
      p.callId !== call.id ||
      p.ownerId !== call.grant.ownerId ||
      p.kind !== 'REQUEST' ||
      p.sizeBytes < 1 ||
      p.sizeBytes > config.maxRequestBytes ||
      p.blob.bytes.byteLength !== p.sizeBytes ||
      p.blob.sizeBytes !== p.sizeBytes ||
      p.checksum !== call.requestSha256 ||
      p.blob.checksum !== p.checksum
    )
      return { limit: ceiling, status: 'UNVERIFIED' };
    const bytes = Buffer.from(p.blob.bytes);
    if (checksumBuffer(bytes) !== call.requestSha256)
      return { limit: ceiling, status: 'UNVERIFIED' };
    const request = JSON.parse(bytes.toString('utf8')) as {
      model?: unknown;
      max_tokens?: unknown;
    };
    if (
      request.model !== call.grant.route.modelId ||
      !Number.isInteger(request.max_tokens) ||
      Number(request.max_tokens) < 1 ||
      Number(request.max_tokens) > ceiling
    )
      return { limit: ceiling, status: 'UNVERIFIED' };
    return { limit: Number(request.max_tokens), status: 'VERIFIED_REQUEST' };
  } catch {
    return { limit: ceiling, status: 'UNVERIFIED' };
  }
}
