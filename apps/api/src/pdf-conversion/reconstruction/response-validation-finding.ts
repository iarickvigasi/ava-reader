import { z } from 'zod';
import {
  validationKeywords,
  validationPath,
  responseField,
  schemaToken,
  matchingKindRequiredFields,
} from './response-validation-paths';

const index = z.number().int().min(0).max(99999);
const dataPath = z
  .array(z.union([z.string().refine(responseField), index]))
  .max(32);
const check = z
  .object({
    keyword: z.enum(validationKeywords),
    schemaPath: z
      .array(z.union([z.string().refine(schemaToken), index]))
      .max(32),
    instancePath: dataPath,
  })
  .strict();
export const responseValidationDetails = z
  .object({
    origin: z.literal('HOST_RESPONSE'),
    category: z.enum(['JSON_PARSE', 'SCHEMA_VALIDATION']),
    schema: z.literal('RecognitionResponse'),
    checks: z.array(check).max(16),
    complete: z.boolean(),
    checksAreAlternatives: z.boolean().optional(),
    matchingKindRequiredFields: z
      .array(
        z
          .object({
            instancePath: dataPath,
            field: z.string().refine(responseField),
          })
          .strict(),
      )
      .max(16)
      .optional(),
  })
  .strict();
export type ResponseValidationDetails = z.infer<
  typeof responseValidationDetails
>;
export const hostResponseValidationFinding = responseValidationDetails
  .extend({
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    renderSha256: z.string().regex(/^[a-f0-9]{64}$/),
    taskIdSha256: z.string().regex(/^[a-f0-9]{64}$/),
    pageNumber: z.number().int().min(1).max(500),
  })
  .strict();
export type HostResponseValidationFinding = z.infer<
  typeof hostResponseValidationFinding
>;

export function schemaValidationDetails(
  errors: readonly {
    keyword: string;
    schemaPath: string;
    instancePath: string;
  }[],
  value?: unknown,
): ResponseValidationDetails {
  const checks = errors.slice(0, 16).flatMap((error) => {
    const parsed = check.safeParse({
      keyword: error.keyword,
      schemaPath: validationPath(error.schemaPath, true),
      instancePath: validationPath(error.instancePath, false),
    });
    return parsed.success ? [parsed.data] : [];
  });
  const required = matchingKindRequiredFields(value);
  return {
    origin: 'HOST_RESPONSE',
    category: 'SCHEMA_VALIDATION',
    schema: 'RecognitionResponse',
    checks,
    complete: checks.length === errors.length && required.complete,
    checksAreAlternatives: errors.some((error) =>
      ['anyOf', 'oneOf'].includes(error.keyword),
    ),
    matchingKindRequiredFields: required.fields,
  };
}
