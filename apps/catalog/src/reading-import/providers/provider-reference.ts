export type EpubProvider =
  | 'internet-archive'
  | 'standard-ebooks'
  | 'wolne-lektury';
export type ProviderInput = {
  provider?: EpubProvider;
  providerId?: string;
  iaIdentifier?: string;
};
export function providerReference(input: ProviderInput) {
  const provider = input.provider ?? 'internet-archive';
  if (
    (provider !== 'internet-archive' && input.iaIdentifier) ||
    (provider === 'internet-archive' && input.providerId)
  )
    throw new Error('Mixed provider identity');
  const id =
    provider === 'internet-archive' ? input.iaIdentifier : input.providerId;
  if (
    provider === 'internet-archive' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(id ?? '')
  )
    return {
      provider,
      id: id!,
      sourceUrl: `https://archive.org/details/${id}`,
    };
  if (
    provider === 'standard-ebooks' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id ?? '') &&
    id!.length <= 200
  )
    return {
      provider,
      id: id!,
      sourceUrl: `https://standardebooks.org/ebooks/${id}`,
    };
  if (
    provider === 'wolne-lektury' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id ?? '') &&
    id!.length <= 200
  )
    return {
      provider,
      id: id!,
      sourceUrl: `https://wolnelektury.pl/katalog/lektura/${id}/`,
    };
  throw new Error('Invalid provider identifier');
}
export function providerDownload(input: ProviderInput & { filename?: string }) {
  const source = providerReference(input);
  if (source.provider === 'standard-ebooks')
    return `${source.sourceUrl}/downloads/${source.id.replace('/', '_')}.epub?source=download`;
  if (source.provider === 'wolne-lektury')
    return `https://wolnelektury.pl/media/book/epub/${source.id}.epub`;
  if (!input.filename) throw new Error('Missing IA filename');
  return `https://archive.org/download/${source.id}/${input.filename.split('/').map(encodeURIComponent).join('/')}`;
}
