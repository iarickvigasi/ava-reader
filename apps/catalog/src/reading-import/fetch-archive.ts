import { fetchProvider } from './fetch-provider';
export function fetchArchive(url: string, maxBytes: number) {
  return fetchProvider(url, maxBytes, 'internet-archive');
}
