import type { EpubProvider } from './provider-reference';
export function allowedProviderHost(target: URL, provider: EpubProvider) {
  if (
    target.protocol !== 'https:' ||
    target.username ||
    target.password ||
    (target.port && target.port !== '443')
  )
    return false;
  if (provider === 'internet-archive')
    return /^(archive\.org|[a-z0-9-]+\.(us|ca|eu)\.archive\.org)$/.test(
      target.hostname,
    );
  return (
    target.hostname ===
    (provider === 'standard-ebooks' ? 'standardebooks.org' : 'wolnelektury.pl')
  );
}
