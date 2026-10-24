export function exploreReturn(location: string) {
  const url = new URL(location, "https://ava.invalid");
  if (url.pathname === "/app/explore") return url.pathname + url.search;
  const candidate = url.searchParams.get("returnTo");
  if (
    !candidate ||
    candidate.length > 2048 ||
    !/^\/app\/explore(?:\?|$)/.test(candidate)
  )
    return "/app/explore";
  const target = new URL(candidate, "https://ava.invalid");
  return target.pathname + target.search;
}

export function catalogHref(path: string, returnHref: string) {
  return `${path}?${new URLSearchParams({ returnTo: returnHref })}`;
}
