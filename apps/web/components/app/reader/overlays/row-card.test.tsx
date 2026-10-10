import type { ReactElement, KeyboardEvent } from "react";
import { expect, it, vi } from "vitest";
import { RowCard } from "./row-card";
vi.mock("react", async () => ({ ...(await vi.importActual("react")), useRef: () => ({ current: null }) }));
vi.mock("./use-dismiss-on-outside-click", () => ({ useDismissOnOutsideClick: () => undefined }));

function fixture() {
  const onSelect = vi.fn();
  const result = RowCard({ group: "ai-comment-row", isMenuOpen: false, onMenuClose: vi.fn(), onSelect, children: <button>Expand answer</button> }) as ReactElement<{ onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void }>;
  const card = {} as HTMLDivElement;
  const event = (key: string, target: EventTarget = card) => ({ key, target, currentTarget: card, preventDefault: vi.fn() }) as unknown as KeyboardEvent<HTMLDivElement>;
  return { onSelect, handler: result.props.onKeyDown, event };
}
it.each(["Enter", " "])("%s on the saved-answer card selects its passage once", (key) => {
  const f = fixture(), e = f.event(key);
  f.handler(e);
  expect(f.onSelect).toHaveBeenCalledOnce();
  expect(e.preventDefault).toHaveBeenCalledOnce();
});
it.each(["Enter", " "])("%s on nested Expand/Menu/Delete controls keeps their native action and creates no jump", (key) => {
  const f = fixture(), e = f.event(key, new EventTarget());
  f.handler(e);
  expect(f.onSelect).not.toHaveBeenCalled();
  expect(e.preventDefault).not.toHaveBeenCalled();
});
