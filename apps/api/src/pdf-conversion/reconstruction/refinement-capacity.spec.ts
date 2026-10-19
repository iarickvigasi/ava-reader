import { continuationTask } from './continuation-fixture';
import { parsePacket, validatePacket } from './validate-packet';
import { SOURCE_CONTINUATION_POLICY } from '../../library/pdf-import/admission/profile';

const batch = (count: number) => ({
  schema_version: 'ava-book-refinement-batch-4',
  source_sha256: continuationTask.source_sha256,
  source_title_policy: 'ava-frontmatter-title-1',
  source_continuation_policy: SOURCE_CONTINUATION_POLICY,
  tasks: Array.from({ length: count }, (_, i) => ({
    ...continuationTask,
    task_id: `refine-capacity-${i}`,
  })),
});

it.each([48, 64])(
  'frames and parses %s current authored tasks inside the existing byte limit',
  (count) => {
    const bytes = Buffer.from(JSON.stringify(batch(count)));
    expect(bytes.length).toBeLessThan(64 * 1024 ** 2);
    expect(
      parsePacket('ContinuationRefinementBatch', bytes, 64 * 1024 ** 2).tasks,
    ).toHaveLength(count);
  },
);
it('refuses task65 and never expands the64MiB transport bound', () => {
  expect(() =>
    validatePacket('ContinuationRefinementBatch', batch(65)),
  ).toThrow('INVALID_RESULT');
  expect(() =>
    parsePacket(
      'ContinuationRefinementBatch',
      Buffer.alloc(64 * 1024 ** 2 + 1),
      64 * 1024 ** 2,
    ),
  ).toThrow('RESOURCE_LIMIT');
});
it('historical batch3 cannot borrow continuation task authority', () => {
  const value = batch(33);
  expect(() =>
    validatePacket('FrontmatterTitleRefinementBatch', {
      ...value,
      schema_version: 'ava-book-refinement-batch-3',
    }),
  ).toThrow('INVALID_RESULT');
});
