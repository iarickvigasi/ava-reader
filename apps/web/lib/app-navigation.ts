export const appNavigationItems = [
  { href: "/app", label: "Home" },
  { href: "/app/library", label: "Library" },
  { href: "/app/explore", label: "Explore" },
  { href: "/app/connect", label: "Connect" },
] as const;

export function isAppNavigationItemActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}
