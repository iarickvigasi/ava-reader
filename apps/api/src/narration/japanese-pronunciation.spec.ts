import { japanesePronunciation } from './japanese-pronunciation';
it.each([
  ['羅生門', 'ラショーモン'],
  ['芥川龍之介', 'アクタガワリューノスケ'],
  ['或日の暮方の事である', 'アルヒノクレガタノコトデアル'],
])('resolves %s using the Japanese dictionary', async (text, expected) => {
  expect(await japanesePronunciation(text, text)).toBe(expected);
});
it('preserves non-kanji text and contextual particle pronunciation', async () => {
  expect(await japanesePronunciation('こんにちは')).toBe('こんにちは');
  expect(await japanesePronunciation('私は学校へ行く', '私は学校へ行く')).toBe(
    'ワタシワガッコーエイク',
  );
});

it.each([
  ['生', '生きる', 'イ'],
  ['生', '生まれた', 'ウ'],
])('uses okurigana to read %s in %s', async (text, context, reading) => {
  expect(await japanesePronunciation(text, context)).toBe(reading);
});
it('refuses an unresolved partial compound instead of saying the isolated default', async () => {
  await expect(japanesePronunciation('生', '生徒')).rejects.toMatchObject({
    status: 422,
  });
});
