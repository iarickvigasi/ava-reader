import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NativeStructureTask } from './generated/NativeStructureTask';
import type { NativeStructureResponse } from './generated/NativeStructureResponse';
export const nativeTask = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/native-structure-task.json'), 'utf8'),
) as NativeStructureTask;
export const nativeResponse = JSON.parse(
  readFileSync(
    join(__dirname, 'fixtures/native-structure-response.json'),
    'utf8',
  ),
) as NativeStructureResponse;
