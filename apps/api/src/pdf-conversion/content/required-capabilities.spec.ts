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
