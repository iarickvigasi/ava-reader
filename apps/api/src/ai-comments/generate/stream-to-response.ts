import type { Response } from 'express';
import type { AiToolGenerationResult } from '../ai-comment-types';
import { forwardFieldDeltas } from './forward-field-deltas';

// HTTP framing for a tool run: the model id and the cache verdict ride in
// headers, a cache hit is written in one shot, and a live generation hands
// off to the delta forwarder (which ends the response itself).
export async function sendStreamingResponse(
  response: Response,
  result: AiToolGenerationResult,
): Promise<void> {
  response.setHeader('x-ai-model', result.modelId);
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');

  if (result.kind === 'cached') {
    response.setHeader('x-ai-cache', 'hit');
    response.end(result.body);
    return;
  }

  response.setHeader('x-ai-cache', 'miss');
  await forwardFieldDeltas({
    fieldKey: result.fieldKey,
    response,
    stream: result.result,
  });
}
