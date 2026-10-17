import { parseSourceRefusal, SourceContentError } from './source-refusal';
import { sourceRefusalStream } from './source-refusal-stream';

const source = 'a'.repeat(64);
const diagnostic = () => ({
  schema_version: 'ava-source-refusal-1',
  source_sha256: source,
  stage: 'assembly',
  findings: Array.from({ length: 100 }, (_, index) => ({
    code: 'ESSENTIAL_STRUCTURE_UNSUPPORTED',
    severity: 'blocking',
    page: index + 1,
    box: {
      coordinate_space: 'page_points_top_left',
      x0: 1000.123456789123,
      y0: 1000.987654321987,
      x1: 2000.123456789123,
      y1: 2000.987654321987,
    },
    region_box: {
      coordinate_space: 'page_points_top_left',
      x0: 0,
      y0: 0,
      x1: 20000,
      y1: 20000,
    },
    block_id: 'b'.repeat(120),
    segment_id_sha256: 'c'.repeat(64),
    task_id: 't'.repeat(120),
    render_sha256: 'd'.repeat(64),
  })),
});

it('retains a legal maximum-count diagnostic larger than the old 64KiB limit', () => {
  const value = diagnostic();
  const bytes = Buffer.from(JSON.stringify(value));
  expect(bytes.length).toBeGreaterThan(64 * 1024);
  const error = parseSourceRefusal(bytes, source);
  expect(error).toBeInstanceOf(SourceContentError);
  expect(error.diagnostic()).toEqual(value);
});

it('retains all findings through fragmented legacy stream without staging artifacts', async () => {
  const value = diagnostic();
  const bytes = Buffer.from(JSON.stringify(value) + '\n');
  const sink = jest.fn();
  const stream = sourceRefusalStream(source, sink);
  for (let offset = 0; offset < bytes.length; offset += 4096)
    await stream.write(bytes.subarray(offset, offset + 4096));
  expect(sink).not.toHaveBeenCalled();
  try {
    stream.finish(1);
    throw new Error('Expected typed source refusal');
  } catch (error) {
    expect(error).toBeInstanceOf(SourceContentError);
    expect((error as SourceContentError).diagnostic()).toEqual(value);
  }
});

it('keeps diagnostic bytes bounded and retains existing source/count checks', () => {
  expect(() =>
    parseSourceRefusal(Buffer.alloc(256 * 1024 + 1, 32), source),
  ).toThrow('INVALID_RESULT');
  expect(() =>
    parseSourceRefusal(
      Buffer.from(JSON.stringify(diagnostic())),
      'b'.repeat(64),
    ),
  ).toThrow('SOURCE_MISMATCH');
  const value = diagnostic();
  value.findings.push(value.findings[0]);
  expect(() =>
    parseSourceRefusal(Buffer.from(JSON.stringify(value)), source),
  ).toThrow('INVALID_RESULT');
});
