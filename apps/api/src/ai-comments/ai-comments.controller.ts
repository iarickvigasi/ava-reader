import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AiCommentKind } from '@prisma/client';
import type { Response } from 'express';
import { ZodError } from 'zod';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import {
  AiCommentsService,
  type AiToolGenerationResult,
} from './ai-comments.service';
import { etymologySchema, explainSchema, translateSchema } from './dto';

@Controller('library/:libraryItemId/ai-comments')
export class AiCommentsController {
  constructor(private readonly service: AiCommentsService) {}

  @Get()
  @UseGuards(ClerkAuthGuard)
  async list(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
  ) {
    const items = await this.service.list(
      request.auth.clerkUserId,
      libraryItemId,
    );
    return { items };
  }

  @Post('translate')
  @UseGuards(ClerkAuthGuard)
  async translate(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
    @Param('libraryItemId') libraryItemId: string,
    @Body() body: unknown,
  ) {
    const parsed = parseBody(translateSchema, body);
    const result = await this.service.generate({
      clerkUserId: request.auth.clerkUserId,
      libraryItemId,
      kind: AiCommentKind.TRANSLATE,
      text: parsed.text,
      locator: parsed.locator,
      targetLang: parsed.targetLang,
    });
    await sendStreamingResponse(response, result);
  }

  @Post('etymology')
  @UseGuards(ClerkAuthGuard)
  async etymology(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
    @Param('libraryItemId') libraryItemId: string,
    @Body() body: unknown,
  ) {
    const parsed = parseBody(etymologySchema, body);
    const result = await this.service.generate({
      clerkUserId: request.auth.clerkUserId,
      libraryItemId,
      kind: AiCommentKind.ETYMOLOGY,
      text: parsed.text,
      locator: parsed.locator,
    });
    await sendStreamingResponse(response, result);
  }

  @Delete(':id')
  @UseGuards(ClerkAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
    @Param('id') id: string,
  ) {
    await this.service.remove({
      clerkUserId: request.auth.clerkUserId,
      libraryItemId,
      id,
    });
  }

  @Post('explain')
  @UseGuards(ClerkAuthGuard)
  async explain(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
    @Param('libraryItemId') libraryItemId: string,
    @Body() body: unknown,
  ) {
    const parsed = parseBody(explainSchema, body);
    const result = await this.service.generate({
      clerkUserId: request.auth.clerkUserId,
      libraryItemId,
      kind: AiCommentKind.EXPLAIN,
      text: parsed.text,
      locator: parsed.locator,
      context: parsed.context,
      bookTitle: parsed.bookTitle,
      author: parsed.author,
    });
    await sendStreamingResponse(response, result);
  }
}

function parseBody<T>(
  schema: { parse: (input: unknown) => T },
  body: unknown,
): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException(
        error.issues.map((issue) => issue.message).join(', '),
      );
    }
    throw error;
  }
}

const streamingLogger = new Logger('sendStreamingResponse');

async function sendStreamingResponse(
  response: Response,
  result: AiToolGenerationResult,
) {
  response.setHeader('x-ai-model', result.modelId);

  if (result.kind === 'cached') {
    response.setHeader('x-ai-cache', 'hit');
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end(result.body);
    return;
  }

  response.setHeader('x-ai-cache', 'miss');
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');

  // The model returns a JSON object like `{ "translation": "Bonjour" }`. We
  // iterate the partial-object stream from the AI SDK, which emits Zod-parsed
  // partials as the model writes more characters into the field. The field
  // value grows monotonically, so we forward only the new characters to the
  // client — which keeps the existing typewriter UX while guaranteeing the
  // browser never sees the JSON envelope or any extra keys the model invents.
  const { result: stream, fieldKey } = result;
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
    streamingLogger.error(
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
