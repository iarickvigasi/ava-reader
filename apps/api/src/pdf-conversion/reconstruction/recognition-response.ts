import type { RecognitionTask } from './generated/RecognitionTask';
import { validatePacket } from './validate-packet';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function recognitionResponse(task: RecognitionTask, output: string) {
  if (Buffer.byteLength(output) > 8 * 1024 ** 2)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  let raw: unknown;
  try {
    raw = JSON.parse(output) as unknown;
  } catch {
    throw new PdfRuntimeError('INVALID_RESULT');
  }
  canonicalizeStyleColors(raw);
  const response = validatePacket('RecognitionResponse', raw);
  if (
    response.task_id !== task.task_id ||
    response.source_sha256 !== task.source_sha256 ||
    response.render_sha256 !== task.image.sha256 ||
    response.segments.some((s) => s.page !== task.page_number)
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  if (
    response.unresolved?.length ||
    !(
      task.profile_id === 'ava-pdf-prose-en-uk-v3'
        ? ['en', 'english', 'uk', 'ukrainian']
        : ['en', 'english']
    ).includes(response.language.toLowerCase().split('-')[0]) ||
    response.segments.some((s) => s.kind === 'unsupported')
  )
    throw new PdfRuntimeError('UNSUPPORTED_PDF');
  return response;
}

// Hex case carries no visual meaning. Normalize only complete six-digit style
// colours; never repair prose, identifiers, malformed colours or extra fields.
function canonicalizeStyleColors(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach(canonicalizeStyleColors);
    return;
  }
  const object = value as Record<string, unknown>;
  const style = object.style;
  if (style && typeof style === 'object' && !Array.isArray(style)) {
    const properties = style as Record<string, unknown>;
    for (const key of ['color', 'background_color', 'decoration_color']) {
      const color = properties[key];
      if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color))
        properties[key] = color.toLowerCase();
    }
  }
  Object.values(object).forEach(canonicalizeStyleColors);
}
