import { useEffect } from "react";
import { isInteractiveTarget } from "../../shared/utils";
import type { PageStepControls } from "./use-page-stepper";

const KEY_ARROW_LEFT = "ArrowLeft";
const KEY_ARROW_RIGHT = "ArrowRight";

// Arrow-key page turning. ArrowRight → next, ArrowLeft → previous. Ignores
// keypresses while a panel is open or focus is inside an interactive target
// (input, button, etc.).
export function useKeyboardPageNavigation({
  goToNextPage,
  goToPreviousPage,
  isPanelOpen,
}: PageStepControls & { isPanelOpen: boolean }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isPanelOpen || isInteractiveTarget(event.target)) {
        return;
      }

      if (event.key === KEY_ARROW_RIGHT) {
        event.preventDefault();
        goToNextPage();
      }

      if (event.key === KEY_ARROW_LEFT) {
        event.preventDefault();
        goToPreviousPage();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [goToNextPage, goToPreviousPage, isPanelOpen]);
}
