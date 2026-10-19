// Finite authored source/model-valid fixture; API semantic transport is mocked in flow tests.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PrintedTitleTask } from './generated/PrintedTitleTask';
import type { PrintedTitleResponse } from './generated/PrintedTitleResponse';
export const printedTitleTask = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/printed-title-task.json'), 'utf8'),
) as PrintedTitleTask;
export const printedTitleResponse = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/printed-title-response.json'), 'utf8'),
) as PrintedTitleResponse;
