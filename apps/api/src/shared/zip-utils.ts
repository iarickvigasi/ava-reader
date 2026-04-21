export function resolveZipPath(
  baseFilePath: string,
  relativeAssetPath: string,
) {
  const baseSegments = baseFilePath.split('/').slice(0, -1);
  const assetSegments = relativeAssetPath.split('/');
  const resolved = [...baseSegments];

  for (const segment of assetSegments) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      resolved.pop();
      continue;
    }

    resolved.push(segment);
  }

  return resolved.join('/');
}
