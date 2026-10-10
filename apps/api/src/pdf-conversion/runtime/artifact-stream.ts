import { checkStreamProfile } from './stream-profile';
import { createHash } from 'node:crypto';
import {
  streamHeader,
  streamChunk,
  decodeStreamLine,
  type StreamArtifact,
} from './stream-schema';
import { PdfRuntimeError } from './runtime-error';
export function artifactStream(
  onArtifact: (descriptor: StreamArtifact, bytes: Buffer) => Promise<void>,
  profile: 'reconstruction' | 'epub-import' = 'reconstruction',
) {
  let header: ReturnType<typeof streamHeader.parse> | undefined,
    pending = Buffer.alloc(0),
    index = 0,
    offset = 0,
    body: Buffer | undefined,
    complete = false;
  const fail = () => {
    throw new PdfRuntimeError('INVALID_RESULT');
  };
  async function line(bytes: Buffer) {
    if (complete) fail();
    const raw = decodeStreamLine(bytes);
    if (!header) {
      header = streamHeader.parse(raw);
      if (
        header.schema_version !==
        (profile === 'epub-import'
          ? 'ava-epub-import-stream-1'
          : 'ava-reconstruct-stream-1')
      )
        fail();
      checkStreamProfile(header.artifacts, profile);
      return;
    }
    if (
      raw &&
      typeof raw === 'object' &&
      !Array.isArray(raw) &&
      Object.keys(raw).length === 1 &&
      (raw as { complete?: unknown }).complete === true
    ) {
      if (index !== header.artifacts.length || body) fail();
      complete = true;
      return;
    }
    const chunk = streamChunk.parse(raw),
      descriptor = header.artifacts[index];
    if (
      !descriptor ||
      chunk.path !== descriptor.path ||
      chunk.offset !== offset
    )
      fail();
    const data = Buffer.from(chunk.base64, 'base64');
    if (
      data.length < 1 ||
      data.length > 256 * 1024 ||
      data.toString('base64') !== chunk.base64 ||
      offset + data.length > descriptor.byte_length
    )
      fail();
    body ??= Buffer.allocUnsafe(descriptor.byte_length);
    data.copy(body, offset);
    offset += data.length;
    if (offset === descriptor.byte_length) {
      if (createHash('sha256').update(body).digest('hex') !== descriptor.sha256)
        fail();
      await onArtifact(descriptor, body);
      body = undefined;
      offset = 0;
      index++;
    }
  }
  return {
    async write(bytes: Buffer) {
      if (bytes.length > 1024 * 1024) fail();
      pending = Buffer.concat([pending, bytes]);
      for (;;) {
        const end = pending.indexOf(10),
          limit = header ? 400 * 1024 : 4 * 1024 ** 2;
        if (end < 0) {
          if (pending.length > limit) fail();
          break;
        }
        if (end > limit) fail();
        const current = pending.subarray(0, end);
        pending = pending.subarray(end + 1);
        await line(current);
      }
    },
    finish() {
      if (pending.length || !complete || !header) fail();
      return header!;
    },
  };
}
