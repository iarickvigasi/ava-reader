export function keepPriorMetadata(prior?: number, next?: number) {
  return (
    Number.isSafeInteger(prior) &&
    prior! >= 0 &&
    (!Number.isSafeInteger(next) || next! < prior!)
  );
}
