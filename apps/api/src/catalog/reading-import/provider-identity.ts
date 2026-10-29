import { createHash } from 'node:crypto';
export function validProviderIdentity(value: {
  provider?: string;
  providerId?: string;
  iaIdentifier?: string;
  sourceKey?: string;
  sourceUrl?: string;
  downloadUrl?: string;
  externalId: string;
  language: string;
}) {
  if (!value.provider || value.provider === 'internet-archive')
    return (
      !!value.iaIdentifier &&
      !value.providerId &&
      !value.sourceUrl &&
      !value.downloadUrl &&
      (value.sourceKey === 'curated-classics'
        ? value.externalId === `curated:${value.iaIdentifier}:${value.language}`
        : /^\/books\/OL\d+M$/.test(value.externalId))
    );
  const id = value.providerId ?? '';
  const se = value.provider === 'standard-ebooks';
  const validId = se
    ? /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)
    : value.provider === 'wolne-lektury' &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
  const page = se
    ? `https://standardebooks.org/ebooks/${id}`
    : `https://wolnelektury.pl/katalog/lektura/${id}/`;
  const download = se
    ? `${page}/downloads/${id.replace('/', '_')}.epub?source=download`
    : `https://wolnelektury.pl/media/book/epub/${id}.epub`;
  const hash = createHash('sha256').update(id).digest('hex');
  return (
    validId &&
    id.length <= 200 &&
    value.sourceKey === 'curated-classics' &&
    !value.iaIdentifier &&
    value.sourceUrl === page &&
    value.downloadUrl === download &&
    value.externalId === `curated:${value.provider}:${hash}:${value.language}`
  );
}
