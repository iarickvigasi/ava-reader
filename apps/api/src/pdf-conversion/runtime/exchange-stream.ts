import type { SandboxInput } from './container-arguments';
import { ExchangeFailure } from './exchange-failure';
import { exchangeEntry } from './exchange-entry';
import { exchangeJson } from './exchange-json';
import {
  exchangeProtocol,
  exchangeReply,
  MAX_EXCHANGE_FRAME,
  MAX_EXCHANGE_REPLY_TOTAL,
} from './exchange-protocol';
import { PdfRuntimeError } from './runtime-error';

export function exchangeStream(
  input: SandboxInput,
  signal: AbortSignal,
  send: (frame: Buffer, last: boolean) => Promise<void>,
  pause: () => void,
) {
  if (!exchangeEntry(input))
    throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  const job = exchangeJson(input.jobBytes!) as {
    source: { sha256: string };
    profile_id: string;
  };
  const protocol = exchangeProtocol({
      source_sha256: job.source.sha256,
      profile_id: job.profile_id,
    }),
    header = Buffer.alloc(4);
  let headerBytes = 0,
    body: Buffer | undefined,
    bodyBytes = 0;
  let waiting = false,
    artifacts = false,
    refusal = false,
    artifactBytes = 0,
    replyBytes = 0;
  const consume = async (data: Buffer) => {
    artifactBytes += data.length;
    if (artifactBytes > 704 * 1024 ** 2)
      throw new PdfRuntimeError('RESOURCE_LIMIT');
    // Existing artifact sink owns record framing, inventory and completion validation.
    if (!signal.aborted && data.length) await input.onStdout!(data);
  };
  return {
    get artifacts() {
      return artifacts;
    },
    get waiting() {
      return waiting;
    },
    get refusal() {
      return refusal;
    },
    async write(data: Buffer) {
      if (signal.aborted) return;
      if (waiting) throw new PdfRuntimeError('INVALID_RESULT');
      if (refusal) throw new PdfRuntimeError('INVALID_RESULT');
      if (artifacts) {
        pause();
        return consume(data);
      }
      let offset = 0;
      if (!body) {
        const copied = data.copy(header, headerBytes, 0, 4 - headerBytes);
        offset += copied;
        headerBytes += copied;
        if (headerBytes < 4) return;
        const length = header.readUInt32BE();
        if (length < 1 || length > MAX_EXCHANGE_FRAME)
          throw new PdfRuntimeError('RESOURCE_LIMIT');
        body = Buffer.alloc(length);
      }
      const copied = data.copy(
        body,
        bodyBytes,
        offset,
        offset + body.length - bodyBytes,
      );
      bodyBytes += copied;
      offset += copied;
      if (bodyBytes < body.length) return;
      const bytes = body,
        request = protocol.accept(bytes),
        remainder = data.subarray(offset);
      body = undefined;
      bodyBytes = 0;
      headerBytes = 0;
      if (request.kind !== 'artifacts' && remainder.length)
        throw new PdfRuntimeError('INVALID_RESULT');
      waiting = true;
      refusal = request.kind === 'refusal';
      if (request.kind === 'artifacts') {
        artifacts = true;
        pause();
      }
      let reply: Buffer;
      try {
        reply = await input.onExchange!(bytes, signal);
      } catch (error) {
        if (error instanceof Error) throw new ExchangeFailure(error);
        throw new PdfRuntimeError('WORKER_CRASH');
      }
      if (signal.aborted) return;
      if (request.kind === 'refusal') {
        if (!Buffer.isBuffer(reply) || reply.length)
          throw new PdfRuntimeError('INVALID_RESULT');
        await send(Buffer.alloc(0), true);
        waiting = false;
        return;
      }
      if (request.kind === 'artifacts') {
        if (!Buffer.isBuffer(reply) || reply.length)
          throw new PdfRuntimeError('INVALID_RESULT');
        waiting = false;
        return consume(remainder);
      }
      const frame = exchangeReply(reply, request);
      replyBytes += frame.length;
      if (replyBytes > MAX_EXCHANGE_REPLY_TOTAL)
        throw new PdfRuntimeError('RESOURCE_LIMIT');
      await send(frame, protocol.lastReply);
      waiting = false;
    },
    finish(exitCode: number | null = 0) {
      if (
        waiting ||
        body ||
        headerBytes ||
        (refusal ? exitCode !== 1 : !artifacts)
      )
        throw new PdfRuntimeError('INVALID_RESULT');
    },
  };
}
