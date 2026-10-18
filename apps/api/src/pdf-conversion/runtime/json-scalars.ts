import { PdfRuntimeError } from './runtime-error';

// Check before UTF-8 encoding too: Buffer.from would replace literal lone surrogates.
export function requireJsonScalars(value: unknown): void {
  if (typeof value === 'string') {
    if (
      /[\ud800-\udfff\ufffe\uffff]/u.test(value) ||
      Array.from(value).some((char) => {
        const code = char.codePointAt(0)!;
        return code < 32 && code !== 9 && code !== 10 && code !== 13;
      })
    )
      throw new PdfRuntimeError('INVALID_RESULT');
  } else if (value && typeof value === 'object')
    Object.values(value).forEach(requireJsonScalars);
}
