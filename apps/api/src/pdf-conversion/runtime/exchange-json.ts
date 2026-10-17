import { PdfRuntimeError } from './runtime-error';

// JSON.parse alone silently replaces duplicate object keys, including bindings.
export function exchangeJson(bytes: Buffer): unknown {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const objects: (Set<string> | null)[] = [];
    for (let index = 0; index < text.length; index++) {
      const token = text[index];
      if (token === '{' || token === '[') {
        objects.push(token === '{' ? new Set() : null);
        if (objects.length > 128) throw new Error('JSON depth');
      } else if (token === '}' || token === ']') objects.pop();
      else if (token === '"') {
        const start = index++;
        for (; index < text.length && text[index] !== '"'; index++)
          if (text[index] === '\\') index++;
        let next = index + 1;
        while (next < text.length && /\s/.test(text[next])) next++;
        if (text[next] === ':') {
          const keys = objects.at(-1);
          const key = JSON.parse(text.slice(start, index + 1)) as string;
          if (!keys || keys.has(key)) throw new Error('Duplicate key');
          keys.add(key);
        }
      }
    }
    return JSON.parse(text) as unknown;
  } catch {
    throw new PdfRuntimeError('INVALID_RESULT');
  }
}
