export function catalogHref(path: string, returnHref: string) {
  return `${path}?${new URLSearchParams({ returnTo: returnHref })}`;
}
