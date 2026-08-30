import { Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { AiToolGenerationResult } from '../ai-comment-types';

type StreamGeneration = Extract<AiToolGenerationResult, { kind: 'stream' }>;

const logger = new Logger('forwardFieldDeltas');

// The model returns a JSON object like `{ "translation": "Bonjour" }`. We
// iterate the partial-object stream from the AI SDK, which emits Zod-parsed
// partials as the model writes more characters into the field. The field
// value grows monotonically, so we forward only the new characters to the
// client — which keeps the existing typewriter UX while guaranteeing the
// browser never sees the JSON envelope or any extra keys the model invents.
// Always ends the response, including on failure.
export async function forwardFieldDeltas(args: {
  fieldKey: StreamGeneration['fieldKey'];
  response: Response;
  stream: StreamGeneration['result'];
}): Promise<void> {
  const { fieldKey, response, stream } = args;
  let lastEmitted = '';

  try {
    for await (const partial of stream.partialObjectStream) {
      const value = (partial as Record<string, unknown> | undefined)?.[
        fieldKey
      ];
      if (typeof value !== 'string') {
        continue;
      }
      if (value.length > lastEmitted.length) {
        response.write(value.slice(lastEmitted.length));
        lastEmitted = value;
      }
    }

    // Final reconciliation. `await stream.object` resolves with the
    // schema-validated result; if the very last delta wasn't surfaced as a
    // partial (rare, but possible), this catches the trailing characters.
    const finalObject = (await stream.object) as Record<string, unknown>;
    const finalValue = finalObject?.[fieldKey];
    if (
      typeof finalValue === 'string' &&
      finalValue.length > lastEmitted.length
    ) {
      response.write(finalValue.slice(lastEmitted.length));
    }
  } catch (error: unknown) {
    // The model produced output the schema couldn't validate, or the stream
    // was severed mid-flight. Surface a terminal note so the client doesn't
    // hang on an indefinite "Generating…" state. We don't reset headers —
    // they're already on the wire.
    logger.error(
      'streamObject failed',
      error instanceof Error ? error.stack : String(error),
    );
    if (lastEmitted.length === 0) {
      response.write(
        'Sorry, the AI response could not be parsed. Please try again.',
      );
    }
  } finally {
    response.end();
  }
}
