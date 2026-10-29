import { fetchProvider } from '../fetch-provider';
import {
  providerDownload,
  providerReference,
  type ProviderInput,
} from './provider-reference';
export async function digitalSource(
  input: ProviderInput & {
    language: string;
    sourceUrl?: string;
    downloadUrl?: string;
  },
) {
  const source = providerReference(input);
  if (source.provider === 'internet-archive')
    throw new Error('Expected a digital EPUB provider');
  const downloadUrl = providerDownload(input);
  if (
    (input.sourceUrl && input.sourceUrl !== source.sourceUrl) ||
    (input.downloadUrl && input.downloadUrl !== downloadUrl)
  )
    throw new Error('Provider source URL changed');
  const url =
    source.provider === 'wolne-lektury'
      ? `https://wolnelektury.pl/api/books/${source.id}/?format=json`
      : source.sourceUrl;
  const raw = await fetchProvider(url, 4 * 1024 * 1024, source.provider);
  const metadata: Record<string, unknown> =
    source.provider === 'wolne-lektury'
      ? (JSON.parse(raw.toString('utf8')) as Record<string, unknown>)
      : { html: raw.toString('utf8') };
  if (
    source.provider === 'wolne-lektury' &&
    (metadata.epub !== downloadUrl ||
      metadata.url !== source.sourceUrl ||
      (metadata.language === 'pol' ? 'pl' : metadata.language) !==
        input.language)
  )
    throw new Error(
      'Wolne Lektury metadata does not match the selected EPUB/language',
    );
  const bytes = await fetchProvider(
    downloadUrl,
    50 * 1024 * 1024,
    source.provider,
  );
  if (bytes.length < 4 || bytes.readUInt32LE(0) !== 0x04034b50)
    throw new Error('Provider returned HTML or an invalid EPUB');
  return {
    bytes,
    metadata: {
      provider: source.provider,
      providerId: source.id,
      sourceUrl: source.sourceUrl,
      ...metadata,
    },
    sourceUrl: source.sourceUrl,
    downloadUrl,
    filename: `${source.id.replace('/', '_')}.epub`,
  };
}
