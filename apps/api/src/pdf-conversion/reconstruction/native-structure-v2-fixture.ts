import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validatePacket } from './validate-packet';
export const nativeTask2 = validatePacket(
  'NativeStructureTask2',
  JSON.parse(
    readFileSync(
      join(__dirname, 'fixtures/native-structure-v2-task.json'),
      'utf8',
    ),
  ),
);
export const nativeResponse2 = validatePacket(
  'NativeStructureResponse2',
  JSON.parse(
    readFileSync(
      join(__dirname, 'fixtures/native-structure-v2-response.json'),
      'utf8',
    ),
  ),
);
