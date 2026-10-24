/** Resolve the catalog base before Next compiles it into browser JavaScript.
 * @param {string | undefined} configured
 * @param {boolean} production
 */
export function resolveCatalogApiBase(configured, production) {
  const base =
    configured ?? (production ? "/catalog" : "http://localhost:4001");
  if (base === "/catalog" || base === "/catalog/") return "/catalog";
  const url = new URL(base);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "NEXT_PUBLIC_CATALOG_API_BASE_URL must be /catalog or an HTTP(S) origin without /api",
    );
  }
  const loopback =
    /^(localhost|.*\.localhost|127\..*|0\.0\.0\.0|\[::1\])$/.test(url.hostname);
  if (production && (url.protocol !== "https:" || loopback)) {
    throw new Error(
      "Production catalog base must be /catalog or a non-loopback HTTPS origin",
    );
  }
  return url.origin;
}
