import { contractSchemas } from './generated/schemas';
import { MAX_ACTIVE_DEADLINE_SECONDS } from './execution-limits';

it('keeps the coordinator deadline identical to the worker structural contract', () => {
  expect(
    contractSchemas['ava-pdf-job-1'].properties.active_deadline_seconds.maximum,
  ).toBe(MAX_ACTIVE_DEADLINE_SECONDS);
});
