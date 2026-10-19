import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SourceFeatureTask } from './generated/SourceFeatureTask';
import type { SourceFeatureResponse } from './generated/SourceFeatureResponse';
export const featureTask = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/source-feature-task.json'), 'utf8'),
) as SourceFeatureTask;
export const featureResponse = JSON.parse(
  readFileSync(
    join(__dirname, 'fixtures/source-feature-response.json'),
    'utf8',
  ),
) as SourceFeatureResponse;
