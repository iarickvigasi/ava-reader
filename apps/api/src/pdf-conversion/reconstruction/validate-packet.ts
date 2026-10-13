import type { Packets } from './packet-types';
import { validatePacketAuthority } from './validate-packet-authority';
import Ajv2020 from 'ajv/dist/2020';
import { recognitionSchemas } from './generated/schemas';
import { PdfRuntimeError } from '../runtime/runtime-error';

const ajv = new Ajv2020({
  strict: true,
  allErrors: false,
  validateFormats: false,
});
ajv.addKeyword({ keyword: 'discriminator', valid: true });
const schemaRegistry: Record<
  string,
  Record<string, unknown>
> = recognitionSchemas;
const validators = new Map(
  Object.entries(schemaRegistry).map(([name, schema]) => [
    name,
    ajv.compile(schema),
  ]),
);
export function validatePacket<K extends keyof Packets>(
  name: K,
  value: unknown,
): Packets[K] {
  if (!validators.get(name)?.(value))
    throw new PdfRuntimeError('INVALID_RESULT');
  validatePacketAuthority(name, value);
  return value as Packets[K];
}
export function parsePacket<K extends keyof Packets>(
  name: K,
  bytes: Buffer,
  limit: number,
): Packets[K] {
  if (bytes.length > limit) throw new PdfRuntimeError('RESOURCE_LIMIT');
  try {
    return validatePacket(
      name,
      JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      ) as unknown,
    );
  } catch (error) {
    if (error instanceof PdfRuntimeError) throw error;
    throw new PdfRuntimeError('INVALID_RESULT');
  }
}
