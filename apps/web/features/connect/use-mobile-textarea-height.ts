import { useLayoutEffect, useRef } from "react";

export function useMobileTextareaHeight(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;

    function resize() {
      if (!textarea) return;
      textarea.style.height = "";
      if (window.matchMedia("(max-width: 639px)").matches) {
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [value]);

  return ref;
}
