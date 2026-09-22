import { useEffect } from "react";

/** Optional device simulation for browser tools with viewport-only emulation. */
export function useFixturePhone() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("phone") !== "1")
      return;
    const nativeMatchMedia = window.matchMedia;
    const properties: [object, string, () => unknown][] = [
      [screen, "width", () => innerWidth],
      [screen, "height", () => innerHeight],
      [
        screen.orientation,
        "type",
        () =>
          innerWidth > innerHeight ? "landscape-primary" : "portrait-primary",
      ],
    ];
    const originals = properties.map(([object, key]) =>
      Object.getOwnPropertyDescriptor(object, key),
    );
    properties.forEach(([object, key, get]) =>
      Object.defineProperty(object, key, { configurable: true, get }),
    );
    window.matchMedia = (query) => {
      const result = nativeMatchMedia.call(window, query);
      if (query === "(pointer: coarse)")
        Object.defineProperty(result, "matches", { value: true });
      return result;
    };
    window.dispatchEvent(new Event("resize"));
    return () => {
      window.matchMedia = nativeMatchMedia;
      properties.forEach(([object, key], index) => {
        const descriptor = originals[index];
        if (descriptor) Object.defineProperty(object, key, descriptor);
        else Reflect.deleteProperty(object, key);
      });
      window.dispatchEvent(new Event("resize"));
    };
  }, []);
}
