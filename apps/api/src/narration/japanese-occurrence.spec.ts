import { japanesePronunciation } from './japanese-pronunciation';
import { narrationSchema } from './narration.controller';
const context = '生まれた子は元気に生きる';
it.each([
  [0, 'ウ'],
  [context.lastIndexOf('生'), 'イ'],
])('reads the selected occurrence at %s', async (offset, reading) => {
  expect(await japanesePronunciation('生', context, offset)).toBe(reading);
});
it('does not silently choose the first differing homograph for legacy requests', async () => {
  await expect(japanesePronunciation('生', context)).rejects.toMatchObject({
    status: 422,
  });
});
it('accepts legacy repeated fragments when every contextual reading agrees', async () => {
  expect(await japanesePronunciation('生', '生きる、生きる')).toBe('イ');
});
it.each([-1, 1.5, 1, 8193])(
  'rejects an invalid or mismatched context offset %s',
  (contextOffset) => {
    expect(
      narrationSchema.safeParse({ text: '生', context, contextOffset }).success,
    ).toBe(false);
  },
);
it('accepts an exact offset and rejects offset without context', () => {
  expect(
    narrationSchema.safeParse({
      text: '生',
      context,
      contextOffset: context.lastIndexOf('生'),
    }).success,
  ).toBe(true);
  expect(
    narrationSchema.safeParse({ text: '生', contextOffset: 0 }).success,
  ).toBe(false);
});

it.each(['😀生きる。', '😀😀生きる。', '𠮷生きる。'])(
  'keeps UTF-16 offsets after supplementary context %s',
  async (context) => {
    expect(
      await japanesePronunciation('生', context, context.indexOf('生')),
    ).toBe('イ');
  },
);
it('refuses selected supplementary kanji instead of dropping its pronunciation', async () => {
  await expect(
    japanesePronunciation('𠮷生', '𠮷生きる。', 0),
  ).rejects.toMatchObject({ status: 422 });
});
