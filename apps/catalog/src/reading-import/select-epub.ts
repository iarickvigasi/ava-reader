type Raw = Record<string, unknown>;

export function selectEpub(item: Raw, filename?: string): Raw {
  const metadata = item.metadata as Raw | undefined;
  const collections = metadata?.collection;
  const flags = [
    metadata?.access_restricted,
    metadata?.['access-restricted-item'],
    metadata?.is_dark,
    item.is_dark,
    item.is_restricted,
  ];
  if (
    !metadata ||
    flags.some(
      (flag) => flag === true || flag === 'true' || flag === '1' || flag === 1,
    ) ||
    metadata.mediatype !== 'texts' ||
    (Array.isArray(collections) ? collections : [collections]).some(
      (value) =>
        typeof value === 'string' &&
        /(^|_)(inlibrary|printdisabled|lendinglibrary)($|_)/i.test(value),
    )
  )
    throw new Error('Restricted or unsupported Internet Archive item');
  const files = Array.isArray(item.files) ? (item.files as Raw[]) : [];
  const epubs = files.filter(
    (file) =>
      typeof file.name === 'string' &&
      /\.epub$/i.test(file.name) &&
      (!filename || file.name === filename) &&
      !file.private &&
      !/lcp|encrypted|drm/i.test(String(file.format)) &&
      /^[a-f\d]{32}$/i.test(String(file.md5)) &&
      Number(file.size) > 0 &&
      !file.name.includes('..') &&
      !file.name.includes('\\') &&
      ![...file.name].some((char) => char.charCodeAt(0) < 32),
  );
  if (epubs.length !== 1)
    throw new Error(
      `Expected one unrestricted EPUB; found ${epubs.length}. Select exact filename.`,
    );
  return epubs[0];
}
