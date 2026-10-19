import { fixtureBytes } from '../contracts/contract-fixtures';
import { parseContractJson } from '../contracts/parse-json';
import type { CanonicalBookV2 } from '../contracts/generated/ava-book-2';
import { requiredCapabilities } from './required-capabilities';

function book() {
  return parseContractJson(fixtureBytes('ava-book-2')) as CanonicalBookV2;
}
it('requires annotation style qualification even for an explicit decoration reset', () => {
  const input = book();
  const style = input.styles.find((s) =>
    input.blocks.some((b) => b.style_id === s.id),
  )!;
  expect(style).toBeDefined();
  expect(requiredCapabilities(input)).not.toContain('annotation-styles');
  style.underline = false;
  expect(requiredCapabilities(input)).toContain('annotation-styles');
});
it('does not require annotation styles for an unused style record', () => {
  const input = book();
  input.styles.push({ id: 'unused-annotation', background_color: '#ffff00' });
  expect(requiredCapabilities(input)).not.toContain('annotation-styles');
});

it('requires language qualification when any canonical text has an explicit language', () => {
  const input = book();
  expect(requiredCapabilities(input)).not.toContain('language');
  const node = input.blocks.find((block) => 'content' in block)!;
  if (!('content' in node)) throw Error('fixture requires text');
  node.content.language = 'uk';
  expect(requiredCapabilities(input)).toContain('language');
});

it('requires exact source-page support from marked addresses only', () => {
  const reader = parseContractJson(
    fixtureBytes('ava-reader-3', 'source-pages'),
  ) as { book: CanonicalBookV2 };
  expect(requiredCapabilities(reader.book)).toContain('source-page-starts');
  const legacy = book();
  legacy.addresses[0].fragment = 'ava-source-page-1';
  expect(requiredCapabilities(legacy)).not.toContain('source-page-starts');
});

it('requires independent marker qualification including marker-only colors', () => {
  const input = book();
  const item = input.blocks.find((b) => b.kind === 'list_item')!;
  if (item.kind !== 'list_item') throw Error('fixture requires list');
  const body = JSON.stringify(item.content);
  input.styles.push({ id: 'source-marker', bold: false, color: '#1f3763' });
  expect(requiredCapabilities(input)).not.toContain('list-marker-styles');
  item.marker_style_id = 'source-marker';
  expect(requiredCapabilities(input)).toEqual(
    expect.arrayContaining([
      'styles',
      'lists',
      'list-marker-styles',
      'annotation-styles',
    ]),
  );
  expect(JSON.stringify(item.content)).toBe(body);
});

it('requires literal-marker qualification without changing the original text', () => {
  const input = book();
  const before = JSON.stringify(input.blocks);
  expect(requiredCapabilities(input)).not.toContain('literal-list-markers');
  input.lists[0].marker_style = 'none';
  expect(requiredCapabilities(input)).toContain('literal-list-markers');
  expect(JSON.stringify(input.blocks)).toBe(before);
});
