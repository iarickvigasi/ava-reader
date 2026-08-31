// iOS is the only platform where the app draws the selection itself (spec 1.6
// Behaviour 8). iPadOS reports a Mac user agent, so touch points — not the UA
// alone — are what separate it from desktop Safari.
export function isIosTouch(win: Window): boolean {
  const ua = win.navigator.userAgent;

  if (/iPhone|iPod/.test(ua)) {
    return true;
  }

  return /iPad|Macintosh/.test(ua) && win.navigator.maxTouchPoints > 1;
}
