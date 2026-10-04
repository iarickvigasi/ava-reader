import { createHash } from 'node:crypto';
import { recognitionResponse } from './recognition-response';
import { task, response } from './test-fixture';
import { wireSegment } from './wire-segment-fixture';
import { SourceContentError, parseSourceRefusal } from './source-refusal';
import { bindTaskRefusal } from './bind-task-refusal';

function refusal(change: Partial<typeof response> = {}) {
  try {
    recognitionResponse(
      task,
      JSON.stringify({
        ...response,
        unresolved: ['private source prose'],
        ...change,
      }),
    );
  } catch (error) {
    if (error instanceof SourceContentError) return error;
    throw error;
  }
  throw new Error('Expected source refusal');
}

it('retains only pinned task/source/render identity and source region for unresolved prose', () => {
  const diagnostic = refusal().diagnostic();
  expect(diagnostic).toMatchObject({
    source_sha256: task.source_sha256,
    stage: 'extraction',
    findings: [
      {
        code: 'RECOGNITION_UNRESOLVED',
        severity: 'blocking',
        page: 1,
        task_id: task.task_id,
        render_sha256: task.image.sha256,
        region_box: task.region_box,
        box: task.region_box,
      },
    ],
  });
  expect(JSON.stringify(diagnostic)).not.toContain('private source prose');
  expect(JSON.stringify(diagnostic)).not.toContain('native_evidence');
  diagnostic.findings[0].page = 500;
  expect(refusal().diagnostic().findings[0].page).toBe(1);
});
it('maps unsupported normalized boxes through the pinned source crop without text disclosure', () => {
  const cropped = {
    ...task,
    region_box: { ...task.region_box, x0: 20, y0: 30, x1: 120, y1: 230 },
  };
  let error: unknown;
  const segment = {
    ...wireSegment,
    kind: 'unsupported' as const,
    id: 'unsafe identifier private prose',
    text: 'private book text',
    box: { ...wireSegment.box, x0: 100, y0: 200, x1: 600, y1: 600 },
  };
  try {
    recognitionResponse(
      cropped,
      JSON.stringify({ ...response, segments: [segment] }),
    );
  } catch (failure) {
    error = failure;
  }
  expect(error).toBeInstanceOf(SourceContentError);
  const diagnostic = (error as SourceContentError).diagnostic();
  expect(diagnostic.findings[0]).toMatchObject({
    code: 'ESSENTIAL_STRUCTURE_UNSUPPORTED',
    box: { x0: 30, y0: 70, x1: 80, y1: 150 },
    block_id: null,
    segment_id_sha256: createHash('sha256').update(segment.id).digest('hex'),
  });
  expect(JSON.stringify(diagnostic)).not.toContain('private');
});
it.each(['source_sha256', 'task_id', 'render_sha256', 'page', 'region_box'])(
  'refuses mismatched %s task evidence',
  (key) => {
    const diagnostic = refusal().diagnostic();
    if (key === 'source_sha256') diagnostic.source_sha256 = 'b'.repeat(64);
    else
      Object.assign(diagnostic.findings[0], {
        [key]:
          key === 'page'
            ? 2
            : key === 'region_box'
              ? { ...task.region_box, x1: 700 }
              : 'b'.repeat(key === 'render_sha256' ? 64 : 1),
      });
    expect(() =>
      bindTaskRefusal(new SourceContentError(diagnostic), [task]),
    ).toThrow('SOURCE_MISMATCH');
  },
);
it.each([
  (d: ReturnType<SourceContentError['diagnostic']>) =>
    Object.assign(d, { source_text: 'private' }),
  (d: ReturnType<SourceContentError['diagnostic']>) => {
    d.findings[0].box.x0 = -1;
  },
  (d: ReturnType<SourceContentError['diagnostic']>) => {
    d.findings[0].box.x1 = 613;
  },
  (d: ReturnType<SourceContentError['diagnostic']>) => {
    d.findings[0].box.x0 = 612;
  },
  (d: ReturnType<SourceContentError['diagnostic']>) => {
    d.findings[0].task_id = 'unsafe id';
  },
  (d: ReturnType<SourceContentError['diagnostic']>) => {
    d.findings = [];
  },
])(
  'rejects malformed source-refusal fields/geometry and never stores extra data',
  (mutate) => {
    const diagnostic = refusal().diagnostic();
    mutate(diagnostic);
    expect(() =>
      parseSourceRefusal(
        Buffer.from(JSON.stringify(diagnostic)),
        task.source_sha256,
      ),
    ).toThrow('INVALID_RESULT');
  },
);
it('rejects foreign source, oversized packets and malformed UTF-8', () => {
  const bytes = Buffer.from(JSON.stringify(refusal().diagnostic()));
  expect(() => parseSourceRefusal(bytes, 'b'.repeat(64))).toThrow(
    'SOURCE_MISMATCH',
  );
  expect(() =>
    parseSourceRefusal(Buffer.alloc(65537), task.source_sha256),
  ).toThrow('INVALID_RESULT');
  expect(() =>
    parseSourceRefusal(Buffer.from([255]), task.source_sha256),
  ).toThrow('INVALID_RESULT');
});
