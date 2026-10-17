import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePacket } from './validate-packet';
import { recognitionResponse } from './recognition-response';

const bytes = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', `geometry-${name}.json`));
export const geometryParent = parsePacket(
  'RecognitionTask',
  bytes('parent'),
  8 * 1024 ** 2,
);
export const geometryTask = parsePacket(
  'RecognitionGeometryTask',
  bytes('task'),
  24 * 1024 ** 2,
);
export const geometryAnswer = parsePacket(
  'RecognitionGeometryResponse',
  bytes('response'),
  1024 ** 2,
);
export const geometryOriginalJson = bytes('original').toString('utf8');
export const geometryOriginal = recognitionResponse(
  geometryParent,
  geometryOriginalJson,
);
