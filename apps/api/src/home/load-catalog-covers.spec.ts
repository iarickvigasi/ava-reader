import { loadCatalogCovers } from './load-catalog-covers';

afterEach(() => jest.restoreAllMocks());

it('loads covers by explicit public catalog entry identity', async () => {
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        items: [
          {
            entryId: 'published',
            editionId: 'edition-1',
            coverImageUrl: 'https://public.example/cover.jpg',
          },
        ],
      }),
    ),
  );
  expect(await loadCatalogCovers(['published'])).toEqual(
    new Map([
      [
        'published',
        {
          entryId: 'published',
          editionId: 'edition-1',
          coverImageUrl: 'https://public.example/cover.jpg',
        },
      ],
    ]),
  );
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/reading-assets/covers?entryIds=published'),
    {
      signal: expect.any(AbortSignal) as AbortSignal,
    },
  );
});

it.each(['network', 'http'])(
  'returns no covers on %s failure',
  async (failure) => {
    const fetch = jest.spyOn(globalThis, 'fetch');
    if (failure === 'network')
      fetch.mockRejectedValue(new Error('unavailable'));
    else fetch.mockResolvedValue(new Response('', { status: 503 }));
    expect(await loadCatalogCovers(['published'])).toEqual(new Map());
  },
);

it('does not call catalog for an empty selection', async () => {
  const fetch = jest.spyOn(globalThis, 'fetch');
  expect(await loadCatalogCovers([])).toEqual(new Map());
  expect(fetch).not.toHaveBeenCalled();
});
