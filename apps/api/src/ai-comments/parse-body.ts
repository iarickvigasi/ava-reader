import { BadRequestException } from '@nestjs/common';
import { ZodError } from 'zod';

// Turns a schema rejection into a 400 carrying the joined issue messages —
// the panel renders a permanent failure's reason inline (spec 3), so it has
// to read as a sentence rather than a status code.
export function parseBody<T>(
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
