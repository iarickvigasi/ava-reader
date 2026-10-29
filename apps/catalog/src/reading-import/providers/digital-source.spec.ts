import { digitalSource } from './digital-source';
import { fetchProvider } from '../fetch-provider';
jest.mock('../fetch-provider');
const fetcher = jest.mocked(fetchProvider);
beforeEach(() => jest.resetAllMocks());
const wl = {
  provider: 'wolne-lektury' as const,
  providerId: 'pan-tadeusz',
  language: 'pl',
};
const metadata = {
  url: 'https://wolnelektury.pl/katalog/lektura/pan-tadeusz/',
  epub: 'https://wolnelektury.pl/media/book/epub/pan-tadeusz.epub',
  language: 'pol',
};
const epub = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1]);
it('uses official metadata and saves provenance, not an automatic review', async () => {
  fetcher
    .mockResolvedValueOnce(Buffer.from(JSON.stringify(metadata)))
    .mockResolvedValueOnce(epub);
  expect(await digitalSource(wl)).toMatchObject({
    bytes: epub,
    filename: 'pan-tadeusz.epub',
    metadata: { provider: 'wolne-lektury' },
  });
});
it.each([
  { ...metadata, epub: 'https://evil.test/book.epub' },
  { ...metadata, language: 'eng' },
])(
  'rejects unexpected provider download/language metadata before downloading',
  async (value) => {
    fetcher.mockResolvedValueOnce(Buffer.from(JSON.stringify(value)));
    await expect(digitalSource(wl)).rejects.toThrow('does not match');
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);
it('uses the public Standard Ebooks file endpoint and rejects a download landing page', async () => {
  fetcher
    .mockResolvedValueOnce(Buffer.from('<html>Emma</html>'))
    .mockResolvedValueOnce(Buffer.from('<html>not an EPUB</html>'));
  await expect(
    digitalSource({
      provider: 'standard-ebooks',
      providerId: 'jane-austen/emma',
      language: 'en',
    }),
  ).rejects.toThrow('invalid EPUB');
  expect(fetcher.mock.calls[1][0]).toContain('.epub?source=download');
});
